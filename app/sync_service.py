"""
Сервис фоновой синхронизации с БД.

Изменения по сравнению с v1:
- Поддержка выборки расписания на произвольную дату (не только «сегодня»).
- Ленивый кэш: снапшоты хранятся по ключу (start_date, end_date, cfg_version),
  собираются по требованию, устаревают через N минут.
- Периодическая инвалидация: раз в sync.interval_seconds сбрасываем кэш
  и уведомляем подписчиков SSE о новых данных.
- Публикация событий в очередь SSE (push вместо polling).
"""
from __future__ import annotations

import logging
import queue
import threading
from datetime import date, datetime, timedelta
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler

from .config_loader import ConfigLoader
from .db.base import create_backend, MDBBackend
from .db.schedule_repo import ScheduleRepository, compute_date_range

log = logging.getLogger(__name__)


class ScheduleSyncService:
    def __init__(self, cfg: ConfigLoader):
        self.cfg = cfg
        self._lock = threading.RLock()
        self._backend: MDBBackend | None = None
        self._backend_signature: tuple | None = None

        # cache: {(start_iso, end_iso, cfg_version): {"data": ..., "built_at": datetime}}
        self._cache: dict[tuple[str, str, int], dict] = {}
        self._cache_ttl_seconds: int = 60 * 30  # 30 минут

        self._last_error: str | None = None
        self._last_success_at: datetime | None = None
        self._last_attempt_at: datetime | None = None
        self._latest_default_snapshot: dict | None = None  # снимок по display-периоду

        self._scheduler = BackgroundScheduler(daemon=True)

        # SSE-подписчики
        self._sse_clients: list[queue.Queue] = []
        self._sse_lock = threading.Lock()
        self._data_version: int = 0

    # ---------------- служебное ----------------

    def _ensure_backend(self) -> MDBBackend:
        db_cfg = self.cfg.get("database") or {}
        signature = (db_cfg.get("path"), db_cfg.get("driver"), db_cfg.get("odbc_driver"))
        if self._backend is None or signature != self._backend_signature:
            if self._backend is not None:
                try:
                    self._backend.close()
                except Exception:  # noqa: BLE001
                    pass
            self._backend = create_backend(
                path=db_cfg.get("path"),
                driver=db_cfg.get("driver", "auto"),
                odbc_driver=db_cfg.get("odbc_driver",
                                       "Microsoft Access Driver (*.mdb, *.accdb)"),
                read_timeout=self.cfg.get("sync", "read_timeout_seconds", default=60),
            )
            self._backend_signature = signature
        return self._backend

    def _build_snapshot(self, start: date, end: date, cfg_snapshot: dict) -> dict:
        backend = self._ensure_backend()
        repo = ScheduleRepository(backend, cfg_snapshot)
        data = repo.build_snapshot(start, end)
        data["_config_version"] = cfg_snapshot["_version"]
        return data

    def get_snapshot_for_range(self, start: date, end: date) -> dict:
        """
        Возвращает снапшот для произвольного диапазона.
        Использует кэш, если запись свежая; иначе строит заново.
        """
        cfg_snapshot = self.cfg.snapshot()
        key = (start.isoformat(), end.isoformat(), cfg_snapshot["_version"])
        with self._lock:
            hit = self._cache.get(key)
            if hit and (datetime.now() - hit["built_at"]).total_seconds() < self._cache_ttl_seconds:
                return hit["data"]

        self._last_attempt_at = datetime.now()
        try:
            data = self._build_snapshot(start, end, cfg_snapshot)
        except Exception as e:  # noqa: BLE001
            log.exception("Snapshot build failed for %s..%s: %s", start, end, e)
            with self._lock:
                self._last_error = f"{type(e).__name__}: {e}"
                # инвалидируем backend
                try:
                    if self._backend is not None:
                        self._backend.close()
                except Exception:  # noqa: BLE001
                    pass
                self._backend = None
                self._backend_signature = None
            # если есть протухший — возвращаем его как best-effort
            with self._lock:
                if hit:
                    return hit["data"]
            raise

        with self._lock:
            self._cache[key] = {"data": data, "built_at": datetime.now()}
            self._last_error = None
            self._last_success_at = datetime.now()
            # ограничиваем размер кэша
            if len(self._cache) > 20:
                # выбрасываем самую старую запись
                oldest = min(self._cache.items(), key=lambda kv: kv[1]["built_at"])
                self._cache.pop(oldest[0], None)
        return data

    # ---------------- фоновая синхронизация «дефолтного» периода ----------------

    def _run_periodic_sync(self) -> None:
        """Периодически пересчитывает снапшот для текущего display-периода."""
        try:
            cfg_snapshot = self.cfg.snapshot()
            start, end = compute_date_range(cfg_snapshot)
            # форсируем пересборку — очищаем кэш только по этому ключу
            key = (start.isoformat(), end.isoformat(), cfg_snapshot["_version"])
            with self._lock:
                self._cache.pop(key, None)
            data = self.get_snapshot_for_range(start, end)
            with self._lock:
                self._latest_default_snapshot = data
                self._data_version += 1
            log.info("Periodic sync OK: %d college / %d uni groups, %d lessons",
                     data["stats"]["college_groups"],
                     data["stats"]["university_groups"],
                     data["stats"]["lessons"])
            # push всем клиентам
            self._broadcast({"type": "data_updated", "version": self._data_version,
                             "generated_at": data["generated_at"]})
        except Exception as e:  # noqa: BLE001
            log.warning("Periodic sync failed: %s", e)
            self._broadcast({"type": "sync_error", "error": str(e)})

    # ---------------- SSE ----------------

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=32)
        with self._sse_lock:
            self._sse_clients.append(q)
        log.info("SSE client connected. Total: %d", len(self._sse_clients))
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._sse_lock:
            try:
                self._sse_clients.remove(q)
            except ValueError:
                pass
        log.info("SSE client disconnected. Total: %d", len(self._sse_clients))

    def _broadcast(self, event: dict) -> None:
        with self._sse_lock:
            dead: list[queue.Queue] = []
            for q in self._sse_clients:
                try:
                    q.put_nowait(event)
                except queue.Full:
                    dead.append(q)  # клиент завис — выкидываем
            for q in dead:
                try:
                    self._sse_clients.remove(q)
                except ValueError:
                    pass

    # ---------------- lifecycle ----------------

    def start(self) -> None:
        interval = self.cfg.get("sync", "interval_seconds", default=900)
        self._run_periodic_sync()  # первичный прогон

        self._scheduler.add_job(
            self._run_periodic_sync, trigger="interval", seconds=interval,
            id="sync-db", replace_existing=True, coalesce=True, max_instances=1,
        )
        self._scheduler.add_job(
            self._maybe_reload_config, trigger="interval", seconds=5,
            id="reload-cfg", replace_existing=True, coalesce=True, max_instances=1,
        )
        self._scheduler.add_job(
            self._sse_keepalive, trigger="interval", seconds=25,
            id="sse-keepalive", replace_existing=True,
        )
        self._scheduler.start()
        log.info("Sync scheduler started (interval=%ss)", interval)

    def _sse_keepalive(self) -> None:
        """Периодически шлём heartbeat, чтобы прокси не закрывали соединения."""
        self._broadcast({"type": "ping", "ts": datetime.now().isoformat(timespec="seconds")})

    def _maybe_reload_config(self) -> None:
        if self.cfg.reload():
            # версия конфига поменялась → инвалидируем весь кэш
            with self._lock:
                self._cache.clear()
            # обновим интервал, если поменялся
            new_interval = self.cfg.get("sync", "interval_seconds", default=900)
            try:
                job = self._scheduler.get_job("sync-db")
                if job and job.trigger.interval.total_seconds() != new_interval:  # type: ignore[attr-defined]
                    self._scheduler.reschedule_job(
                        "sync-db", trigger="interval", seconds=new_interval,
                    )
                    log.info("Sync interval updated → %ss", new_interval)
            except Exception:  # noqa: BLE001
                pass
            # уведомим клиентов о смене конфига
            self._broadcast({"type": "config_updated", "version": self.cfg.version})

    def force_sync(self) -> None:
        with self._lock:
            self._cache.clear()
        self._run_periodic_sync()

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            snap = self._latest_default_snapshot
            return {
                "healthy": self._last_error is None and snap is not None,
                "last_success_at": self._last_success_at.isoformat(timespec="seconds")
                    if self._last_success_at else None,
                "last_attempt_at": self._last_attempt_at.isoformat(timespec="seconds")
                    if self._last_attempt_at else None,
                "last_error": self._last_error,
                "cached_snapshots": len(self._cache),
                "data_generated_at": snap.get("generated_at") if snap else None,
                "config_version": self.cfg.version,
                "data_version": self._data_version,
                "sse_clients": len(self._sse_clients),
            }

    def shutdown(self) -> None:
        try:
            self._scheduler.shutdown(wait=False)
        except Exception:  # noqa: BLE001
            pass
        # закроем всех SSE
        self._broadcast({"type": "shutdown"})
        if self._backend is not None:
            try:
                self._backend.close()
            except Exception:  # noqa: BLE001
                pass
