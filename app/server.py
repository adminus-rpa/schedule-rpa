"""
Flask HTTP-сервер:
- Страница расписания
- JSON API с поддержкой произвольного диапазона дат
- SSE endpoint /api/events для push-обновлений
"""
from __future__ import annotations

import json
import logging
import logging.handlers
import os
import queue
from datetime import date, datetime, timedelta
from pathlib import Path

from flask import Flask, Response, jsonify, render_template, request, stream_with_context

from .config_loader import ConfigLoader, resolve_theme
from .db.schedule_repo import compute_date_range
from .sync_service import ScheduleSyncService

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "config.yaml"


def _setup_logging(cfg: ConfigLoader) -> None:
    log_cfg = cfg.get("logging") or {}
    level = getattr(logging, str(log_cfg.get("level", "INFO")).upper(), logging.INFO)
    log_file = log_cfg.get("file") or "./logs/app.log"
    Path(log_file).parent.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(level)
    for h in list(root.handlers):
        root.removeHandler(h)

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    fh = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=int(log_cfg.get("max_bytes", 5 * 1024 * 1024)),
        backupCount=int(log_cfg.get("backup_count", 5)),
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(sh)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _resolve_range(cfg_snapshot: dict, start_param: str | None, end_param: str | None,
                   period_param: str | None) -> tuple[date, date]:
    """
    Разбирает параметры запроса и возвращает (start, end).

    Логика:
      - если ?start=... и ?end=... — используются как есть
      - если ?start=... и ?period=... — период отсчитывается от start
      - иначе — берутся дефолты из config (display.period + display.start)
    """
    start = _parse_date(start_param)
    end = _parse_date(end_param)

    if start and end:
        # ограничим диапазон разумными пределами (максимум 62 дня)
        if end < start:
            start, end = end, start
        if (end - start).days > 62:
            end = start + timedelta(days=62)
        return start, end

    if start and period_param:
        lengths = {"day": 1, "week": 7, "2weeks": 14, "3weeks": 21, "month": 30}
        length = lengths.get(period_param, 7)
        return start, start + timedelta(days=length - 1)

    if start:
        # только start, без периода — используем display.period
        cfg_disp = cfg_snapshot.get("display", {})
        lengths = {"day": 1, "week": 7, "2weeks": 14, "3weeks": 21, "month": 30}
        length = lengths.get(cfg_disp.get("period", "week"), 7)
        return start, start + timedelta(days=length - 1)

    # ничего не передали — дефолт из конфига
    return compute_date_range(cfg_snapshot)


def _load_vite_manifest(static_dir: Path) -> dict:
    """
    Читает app/static/dist/.vite/manifest.json (Vite 5) либо dist/manifest.json (fallback).
    Возвращает dict {'js': '<relative path>', 'css': '<relative path>'}.
    Если manifest не найден — вернёт пустой dict (шаблон покажет заглушку).
    """
    dist_dir = static_dir / "dist"
    candidates = [
        dist_dir / ".vite" / "manifest.json",
        dist_dir / "manifest.json",
    ]
    manifest_path = next((p for p in candidates if p.is_file()), None)
    if manifest_path is None:
        return {}
    try:
        with manifest_path.open("r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:  # noqa: BLE001
        logging.getLogger(__name__).warning("Failed to read vite manifest: %s", e)
        return {}

    # Найдём entry-запись (isEntry=true). Обычно ключ — 'src/main.ts'.
    entry = None
    for value in manifest.values():
        if isinstance(value, dict) and value.get("isEntry"):
            entry = value
            break
    if entry is None:
        return {}

    js_file = entry.get("file", "")
    css_list = entry.get("css") or []
    css_file = css_list[0] if css_list else ""

    # Fallback: если CSS не привязан к entry (конфиг cssCodeSplit=false выносит CSS отдельно),
    # берём первую css-запись в манифесте.
    if not css_file:
        for value in manifest.values():
            if isinstance(value, dict):
                f = value.get("file", "")
                if isinstance(f, str) and f.endswith(".css"):
                    css_file = f
                    break

    return {"js": js_file, "css": css_file}


def create_app(config_path: str | os.PathLike | None = None) -> Flask:
    cfg = ConfigLoader(config_path or CONFIG_PATH)
    _setup_logging(cfg)
    log = logging.getLogger(__name__)

    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "app" / "static"),
        template_folder=str(BASE_DIR / "app" / "templates"),
    )
    app.config["JSON_AS_ASCII"] = False

    # Загружаем Vite-манифест один раз при старте.
    static_dir = BASE_DIR / "app" / "static"
    assets = _load_vite_manifest(static_dir)
    if assets:
        log.info("Vite assets loaded: js=%s css=%s", assets.get("js"), assets.get("css"))
    else:
        log.warning(
            "Vite manifest not found. Run 'cd frontend && npm install && npm run build' "
            "to build frontend. Falling back to raw index without dist assets."
        )

    service = ScheduleSyncService(cfg)
    service.start()

    import atexit
    atexit.register(service.shutdown)

    # =====================================================================
    # РОУТЫ
    # =====================================================================

    @app.route("/")
    def index():
        snap = cfg.snapshot()
        default_start, default_end = compute_date_range(snap)
        boot = {
            "default_start": default_start.isoformat(),
            "default_end":   default_end.isoformat(),
            "default_period": snap["display"]["period"],
            "show_clock":     snap["behavior"]["show_clock"],
            "show_status":    snap["behavior"]["show_status_indicator"],
            "hide_topbar_on_load": snap["behavior"]["hide_topbar_on_load"],
            "client_refresh_seconds": snap["behavior"]["client_refresh_seconds"],
            "fullscreen_on_first_interaction": snap["behavior"]["fullscreen_on_first_interaction"],
        }
        return render_template(
            "index.html",
            cfg=snap,
            theme=resolve_theme(cfg),
            default_start=default_start.isoformat(),
            default_end=default_end.isoformat(),
            boot=boot,
            assets=assets or {"js": "", "css": ""},
        )

    @app.route("/api/schedule")
    def api_schedule():
        cfg_snap = cfg.snapshot()
        start, end = _resolve_range(
            cfg_snap,
            request.args.get("start"),
            request.args.get("end"),
            request.args.get("period"),
        )
        try:
            data = service.get_snapshot_for_range(start, end)
            return jsonify(data)
        except Exception as e:  # noqa: BLE001
            log.exception("Failed to serve /api/schedule: %s", e)
            return jsonify({"error": str(e), "status": service.get_status()}), 503

    def _resolve_bg_url(raw: str) -> str:
        """
        Нормализует путь к background_image в URL:
          - пусто → ""
          - http(s)://... → как есть
          - /... → как есть (абсолютный путь от корня домена)
          - "file.jpg" → "/static/file.jpg"
        """
        v = (raw or "").strip()
        if not v:
            return ""
        low = v.lower()
        if low.startswith("http://") or low.startswith("https://") or low.startswith("data:"):
            return v
        if v.startswith("/"):
            return v
        return "/static/" + v.lstrip("./")

    @app.route("/api/config")
    def api_config():
        snap = cfg.snapshot()
        default_start, default_end = compute_date_range(snap)
        theme = snap["theme"]
        return jsonify({
            "version": snap["_version"],
            "display": snap["display"],
            "theme": {
                "preset": theme["preset"],
                "palette": resolve_theme(cfg),
                "background_image": _resolve_bg_url(theme.get("background_image", "")),
                "background_image_raw": theme.get("background_image", ""),
                "background_opacity": theme.get("background_opacity", 0.1),
                "floor_colors": theme.get("floor_colors", {}),
            },
            "typography": snap["typography"],
            "behavior": snap["behavior"],
            "bells": snap["bells"],
            "defaults": {
                "start": default_start.isoformat(),
                "end": default_end.isoformat(),
                "period": snap["display"]["period"],
            },
        })

    @app.route("/api/status")
    def api_status():
        return jsonify(service.get_status())

    @app.route("/api/sync", methods=["POST"])
    def api_force_sync():
        remote = request.remote_addr or ""
        if remote not in ("127.0.0.1", "::1", "localhost"):
            return jsonify({"error": "forbidden"}), 403
        service.force_sync()
        return jsonify(service.get_status())

    @app.route("/api/events")
    def api_events():
        """
        Server-Sent Events endpoint. Клиент подписывается один раз
        и получает push-обновления при изменении данных/конфига.
        """
        def event_stream(q: queue.Queue):
            try:
                # первое событие — сразу, чтобы клиент понял, что подключён
                yield "event: hello\ndata: {}\n\n"
                while True:
                    try:
                        event = q.get(timeout=30)
                    except queue.Empty:
                        # heartbeat — комментарий SSE
                        yield ": keepalive\n\n"
                        continue
                    etype = event.get("type", "message")
                    payload = json.dumps({k: v for k, v in event.items() if k != "type"},
                                         ensure_ascii=False)
                    yield f"event: {etype}\ndata: {payload}\n\n"
                    if etype == "shutdown":
                        break
            finally:
                service.unsubscribe(q)

        q = service.subscribe()
        # ПРИМЕЧАНИЕ: заголовок Connection — hop-by-hop (PEP 3333) и не может быть выставлен
        # WSGI-приложением. Waitress сам отвечает за keep-alive. Под nginx keep-alive
        # контролируется в конфиге nginx (proxy_http_version 1.1; proxy_set_header Connection "";).
        return Response(
            stream_with_context(event_stream(q)),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",  # для nginx
            },
        )

    @app.route("/healthz")
    def healthz():
        st = service.get_status()
        return (jsonify(st), 200) if st["healthy"] else (jsonify(st), 503)

    @app.errorhandler(404)
    def _404(_e):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(500)
    def _500(e):
        log.exception("Unhandled server error: %s", e)
        return jsonify({"error": "internal server error"}), 500

    log.info("Application initialized")
    return app


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Schedule Board")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9090)
    parser.add_argument("--dev", action="store_true", help="запустить в dev-режиме Flask")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    args = parser.parse_args()

    app = create_app(args.config)
    if args.dev:
        app.run(host=args.host, port=args.port, debug=True, use_reloader=False,
                threaded=True)
    else:
        from waitress import serve
        # threads: не менее 8, чтобы SSE-соединения не блокировали остальные запросы
        serve(app, host=args.host, port=args.port, threads=16,
              channel_timeout=600, cleanup_interval=30)


if __name__ == "__main__":
    main()
