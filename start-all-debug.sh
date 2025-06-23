#!/bin/bash
# start-all-debug.sh
# Professional startup script with robust logging for debugging.

# Get the directory of the script
BASE_DIR=$(dirname "$0")
cd "$BASE_DIR" || exit

# Define log file path
LOG_FILE="$BASE_DIR/backend-startup.log"

echo " M-------------------------------------------------------------------M "
echo " | AXEP MUSIC PLATFORM - DEBUG LAUNCHER                              | "
echo " M-------------------------------------------------------------------M "
echo " | Log file will be created at: $LOG_FILE             | "
echo " M-------------------------------------------------------------------M "

# Clean up previous log file
rm -f "$LOG_FILE"

# Function to kill processes on a specific port
kill_process_on_port() {
  PORT=$1
  echo "🔄 Checking for existing process on port $PORT..."
  PID=$(lsof -t -i:"$PORT")
  if [ -n "$PID" ]; then
    echo "❌ Found running process $PID on port $PORT. Terminating..."
    kill -9 "$PID"
    echo "✅ Process terminated."
  else
    echo "👍 No process found on port $PORT."
  fi
}

# Kill existing processes
kill_process_on_port 3000
kill_process_on_port 3001

echo ""
echo " M-------------------------------------------------------------------M "
echo " | LAUNCHING BACKEND (PORT 3001) - Check logs for status             | "
echo " M-------------------------------------------------------------------M "

# Navigate to backend, install dependencies, and start in the background
# CRITICAL: Redirect all output (stdout and stderr) to the log file
(
  cd backend || exit
  echo "🚀 Installing backend dependencies..."
  npm install
  echo "🚀 Starting backend server..."
  npm run dev
) > "$LOG_FILE" 2>&1 &

BACKEND_PID=$!
echo "⏳ Waiting for backend to initialize (PID: $BACKEND_PID)..."
sleep 15 # Increased wait time for dependencies

# Check if the backend process crashed
if ! ps -p $BACKEND_PID > /dev/null; then
    echo " M-------------------------------------------------------------------M "
    echo " | ❌❌❌ BACKEND FAILED TO START ❌❌❌                         | "
    echo " M-------------------------------------------------------------------M "
    echo " | The backend process crashed. Displaying last 20 lines of log:     |"
    echo " M-------------------------------------------------------------------M "
    tail -n 20 "$LOG_FILE"
    exit 1
fi

# Check backend health
echo "🩺 Checking backend health at http://localhost:3001/health..."
BACKEND_HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)

if [ "$BACKEND_HEALTH_STATUS" -ne 200 ]; then
    echo " M-------------------------------------------------------------------M "
    echo " | ❌❌❌ BACKEND HEALTH CHECK FAILED ❌❌❌                      | "
    echo " M-------------------------------------------------------------------M "
    echo " | Status code: $BACKEND_HEALTH_STATUS. Displaying last 20 lines of log: |"
    echo " M-------------------------------------------------------------------M "
    tail -n 20 "$LOG_FILE"
    kill -9 $BACKEND_PID
    exit 1
else
    echo "✅ Backend is healthy (Status: $BACKEND_HEALTH_STATUS)"
fi

echo ""
echo " M-------------------------------------------------------------------M "
echo " | LAUNCHING FRONTEND (PORT 3000)                                    | "
echo " M-------------------------------------------------------------------M "

# Launch frontend in the current terminal
echo "🚀 Starting frontend development server..."
npm run dev 