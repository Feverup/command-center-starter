#!/usr/bin/env bash
# Start the full stack (API + web) and don't return until it actually serves.
#
# Usage: start-stack.sh [--stop]
#
# The point is that /setup ends with something RUNNING rather than with
# instructions. "Now run pnpm dev" is where a setup flow used to hand the last
# step back to the person it was meant to help — and it is the step where a
# missing token or a port clash surfaces, so it is exactly the wrong step to
# leave unattended.
#
# Verifies by polling the ports, not by checking the process started. A dev server
# that boots and then dies on a config error still counts as "started" to anything
# watching the PID.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

WEB_PORT=5273     # vite.config.ts server.port
API_PORT=4320     # server/index.ts PORT default
LOG="$REPO_ROOT/.dev-server.log"   # gitignored alongside .data/ and .env
PIDFILE="$REPO_ROOT/.dev-server.pid"

listening() { curl -fsS -o /dev/null --max-time 2 "http://localhost:$1/" 2>/dev/null; }
api_up()    { curl -fsS -o /dev/null --max-time 2 "http://localhost:$API_PORT/api/tasks" 2>/dev/null; }

if [[ "${1:-}" == "--stop" ]]; then
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
    echo "OK — stopped."
  else
    echo "Nothing to stop (no live pid in $PIDFILE)."
  fi
  exit 0
fi

# Already serving? Say so and leave it alone. Re-running /setup must not spawn a
# second server fighting for the same ports.
if listening "$WEB_PORT" && api_up; then
  echo "Already running:"
  echo "  web  http://localhost:$WEB_PORT"
  echo "  api  http://localhost:$API_PORT"
  exit 0
fi

echo "Starting the stack (pnpm dev)…"
# setsid/nohup so it survives this script and the /setup session ending.
nohup pnpm dev >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

# Poll rather than sleep-and-hope. 60s covers a cold vite start on a slow machine.
for _ in $(seq 1 60); do
  if listening "$WEB_PORT" && api_up; then
    echo
    echo "OK — the stack is up."
    echo "  web  http://localhost:$WEB_PORT"
    echo "  api  http://localhost:$API_PORT"
    echo "  log  $LOG"
    echo "  stop .claude/scripts/setup/start-stack.sh --stop"
    exit 0
  fi
  # Bail early on a hard failure rather than burning the full minute.
  if grep -qiE "EADDRINUSE|Cannot find module|ERR_MODULE_NOT_FOUND" "$LOG" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo
echo "──────────────────────────────────────────────────────────────"
if grep -qi "EADDRINUSE" "$LOG" 2>/dev/null; then
  echo "A port is already taken — most likely another copy of this app is running."
  echo "Find it:  lsof -nP -iTCP:$API_PORT -sTCP:LISTEN"
  echo "Then stop that one, or set PORT=<other> for the API."
elif grep -qiE "Cannot find module|ERR_MODULE_NOT_FOUND" "$LOG" 2>/dev/null; then
  echo "A dependency is missing — dependencies were probably not installed."
  echo "Run: .claude/scripts/setup/install-deps.sh"
else
  echo "The stack did not come up within 60s."
fi
echo
echo "Web  responding: $(listening "$WEB_PORT" && echo yes || echo no)"
echo "API  responding: $(api_up && echo yes || echo no)"
echo "Last 15 log lines ($LOG):"
tail -15 "$LOG" 2>/dev/null | sed 's/^/  /'
exit 1
