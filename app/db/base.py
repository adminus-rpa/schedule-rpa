"""
Абстракция доступа к MDB-файлу.

Два бэкенда:
  - pyodbc (Windows, штатный Microsoft Access Driver) — рекомендуется на проде;
  - mdbtools (Linux, консольная утилита mdb-export) — для разработки/тестов.

Автовыбор: driver='auto' → на Windows pyodbc, иначе mdbtools.
"""
from __future__ import annotations

import csv
import io
import logging
import shutil
import subprocess
import sys
import threading
from abc import ABC, abstractmethod
from typing import Iterable

log = logging.getLogger(__name__)


class MDBBackend(ABC):
    """Интерфейс бэкенда БД."""

    @abstractmethod
    def query_all(self, table: str) -> list[dict]:
        """Возвращает все строки таблицы как список dict{col: value}."""

    @abstractmethod
    def close(self) -> None: ...


# ---------------------------------------------------------------------------
# PyODBC backend (Windows / Access ODBC)
# ---------------------------------------------------------------------------
class PyODBCBackend(MDBBackend):
    def __init__(self, path: str, odbc_driver: str, read_timeout: int = 60):
        try:
            import pyodbc  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "pyodbc не установлен. Установите: pip install pyodbc (только на Windows)."
            ) from e

        self._pyodbc = pyodbc
        self._path = path
        self._driver = odbc_driver
        self._timeout = read_timeout
        self._lock = threading.RLock()
        self._conn = None
        self._connect()

    def _connect(self):
        conn_str = (
            f"DRIVER={{{self._driver}}};"
            f"DBQ={self._path};"
            f"ReadOnly=True;"
        )
        log.info("PyODBC: connecting to %s", self._path)
        self._conn = self._pyodbc.connect(conn_str, autocommit=True, readonly=True,
                                          timeout=self._timeout)

    def query_all(self, table: str) -> list[dict]:
        with self._lock:
            if self._conn is None:
                self._connect()
            try:
                cur = self._conn.cursor()
                cur.execute(f"SELECT * FROM [{table}]")
                cols = [c[0] for c in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return rows
            except self._pyodbc.Error as e:
                log.warning("PyODBC error, reconnecting: %s", e)
                try:
                    self._conn.close()
                except Exception:  # noqa: BLE001
                    pass
                self._conn = None
                self._connect()
                cur = self._conn.cursor()
                cur.execute(f"SELECT * FROM [{table}]")
                cols = [c[0] for c in cur.description]
                return [dict(zip(cols, r)) for r in cur.fetchall()]

    def close(self) -> None:
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:  # noqa: BLE001
                    pass
                self._conn = None


# ---------------------------------------------------------------------------
# mdbtools backend (Linux) — вызывает mdb-export и парсит CSV.
# ---------------------------------------------------------------------------
class MDBToolsBackend(MDBBackend):
    def __init__(self, path: str, read_timeout: int = 60):
        if shutil.which("mdb-export") is None:
            raise RuntimeError(
                "mdbtools не установлен. Установите: apt-get install mdbtools"
            )
        self._path = path
        self._timeout = read_timeout
        self._lock = threading.RLock()

    def query_all(self, table: str) -> list[dict]:
        with self._lock:
            try:
                # -b strip — не парсить binary поля; -D формат даты стандартный.
                proc = subprocess.run(
                    ["mdb-export", "-D", "%Y-%m-%d %H:%M:%S", self._path, table],
                    capture_output=True, text=True, timeout=self._timeout,
                    encoding="utf-8", errors="replace",
                )
            except subprocess.TimeoutExpired as e:
                raise RuntimeError(f"mdb-export timeout on {table}") from e

            if proc.returncode != 0:
                raise RuntimeError(
                    f"mdb-export failed on {table}: {proc.stderr.strip()}"
                )

            reader = csv.DictReader(io.StringIO(proc.stdout))
            return [dict(row) for row in reader]

    def close(self) -> None:  # nothing persistent
        pass


# ---------------------------------------------------------------------------
# Фабрика бэкенда
# ---------------------------------------------------------------------------
def create_backend(path: str, driver: str = "auto",
                   odbc_driver: str = "Microsoft Access Driver (*.mdb, *.accdb)",
                   read_timeout: int = 60) -> MDBBackend:
    driver = (driver or "auto").lower()
    if driver == "auto":
        driver = "pyodbc" if sys.platform == "win32" else "mdbtools"

    log.info("MDB backend: %s (path=%s)", driver, path)
    if driver == "pyodbc":
        return PyODBCBackend(path, odbc_driver, read_timeout)
    if driver == "mdbtools":
        return MDBToolsBackend(path, read_timeout)
    raise ValueError(f"Unknown driver: {driver!r}")
