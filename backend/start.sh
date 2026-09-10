#!/bin/sh
set -eu

ollama serve >/tmp/ollama.log 2>&1 &
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
