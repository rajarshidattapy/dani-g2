#!/bin/sh
# Linux helper for headless machines: runs the simulator under Xvfb with its automation port.
URL=${1:-http://127.0.0.1:5173/?demo=1}
PORT=${2:-9898}
BIN="$(dirname "$0")/../node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator"
exec xvfb-run -a -s "-screen 0 1280x800x24" "$BIN" "$URL" --automation-port "$PORT"
