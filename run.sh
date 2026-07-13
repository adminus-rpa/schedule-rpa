#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[setup] Creating virtual environment..."
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

echo "[build] Rebuilding Svelte frontend..."
cd frontend
npm install
npm run build
cd ..

echo "[run] Starting server on http://0.0.0.0:9090  (Ctrl+C to stop)"
exec ./.venv/bin/python run.py --host 0.0.0.0 --port 9090 "$@"
