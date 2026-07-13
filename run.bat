@echo off
REM =========================================================================
REM Запуск веб-расписания под Windows (медиа-сервер).
REM =========================================================================
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating virtual environment...
    py -3 -m venv .venv
    if errorlevel 1 (
        echo [error] Python 3 not found. Install from https://www.python.org/
        pause
        exit /b 1
    )
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

echo [run] Starting server on http://0.0.0.0:9090  (Ctrl+C to stop)
".venv\Scripts\python.exe" run.py --host 0.0.0.0 --port 9090
