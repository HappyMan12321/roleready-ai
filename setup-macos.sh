#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  task_python=""
  for candidate in python3.12 python3.13 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; raise SystemExit(sys.version_info < (3, 12))'; then
      task_python="$candidate"
      break
    fi
  done
  if [ -z "$task_python" ]; then
    echo "Please install Python 3.12 from python.org, reopen Terminal, and run this script again."
    exit 1
  fi
  "$task_python" -m venv .venv
fi

.venv/bin/python -m pip install -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
fi
echo "Setup complete. Run: bash run-macos.command"
echo "Demo needs no key. For Live mode, add your own key to .env or the app sidebar."
