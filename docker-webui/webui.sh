#!/bin/bash
# Start / stop / check the Docker web UI inside WSL. Called by the .bat files.
cd "$(dirname "$(readlink -f "$0")")" || exit 1

PORT="${PORT:-8080}"
PIDFILE=/tmp/docker-webui.pid
LOG=/tmp/docker-webui.log
URL="http://127.0.0.1:$PORT/"

is_running() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "$1" in
  start)
    if ! docker info >/dev/null 2>&1; then
      echo "Docker daemon is not responding, trying to start it (may ask for sudo)..."
      sudo systemctl start docker
      sleep 2
    fi
    if ! docker info >/dev/null 2>&1; then
      echo "ERROR: cannot reach Docker. Is it installed and is your user in the docker group?"
      exit 1
    fi
    if is_running || curl -s -o /dev/null "$URL"; then
      echo "Web UI already running at $URL"
      exit 0
    fi
    nohup setsid python3 server.py --port "$PORT" >"$LOG" 2>&1 &
    echo $! >"$PIDFILE"
    for _ in $(seq 1 20); do
      if curl -s -o /dev/null "$URL"; then
        echo "Web UI started at $URL"
        exit 0
      fi
      sleep 0.5
    done
    echo "ERROR: web UI did not come up. Log:"
    tail -n 20 "$LOG"
    exit 1
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PIDFILE")"
    fi
    pkill -f "^python3 server.py" 2>/dev/null
    rm -f "$PIDFILE"
    sleep 1
    if curl -s -o /dev/null "$URL"; then
      echo "ERROR: web UI is still answering on port $PORT"
      exit 1
    fi
    echo "Web UI stopped."
    ;;
  status)
    if curl -s -o /dev/null "$URL"; then echo "running at $URL"; else echo "stopped"; exit 3; fi
    ;;
  *)
    echo "usage: webui.sh start|stop|status"
    exit 2
    ;;
esac
