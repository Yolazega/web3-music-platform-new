#!/bin/bash

echo "🚀 Starting AXEP Web3 Music Platform locally..."
echo "📁 Current directory: $(pwd)"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📂 Script directory: $SCRIPT_DIR"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use"
        return 0
    else
        echo "✅ Port $port is available"
        return 1
    fi
}

# Check ports
echo ""
echo "🔍 Checking ports..."
check_port 3000
FRONTEND_RUNNING=$?
check_port 3001
BACKEND_RUNNING=$?

echo ""
echo "🎵 Starting Frontend (React/Vite) on port 3000..."
cd "$SCRIPT_DIR"
if [ $FRONTEND_RUNNING -eq 0 ]; then
    echo "Frontend already running at http://localhost:3000"
else
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend started with PID: $FRONTEND_PID"
fi

echo ""
echo "🔧 Starting Backend (Node.js/Express) on port 3001..."
cd "$SCRIPT_DIR/backend"
if [ $BACKEND_RUNNING -eq 0 ]; then
    echo "Backend already running at http://localhost:3001"
else
    npm run dev &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
fi

echo ""
echo "⏳ Waiting for servers to start..."
sleep 5

echo ""
echo "🧪 Testing servers..."

# Test frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running at http://localhost:3000"
else
    echo "❌ Frontend failed to start"
fi

# Test backend
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend is running at http://localhost:3001"
else
    echo "❌ Backend failed to start"
fi

echo ""
echo "🎉 AXEP Platform Status:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Admin:    http://localhost:3000 (connect wallet to access admin)"
echo ""
echo "📝 To stop servers, press Ctrl+C or run: pkill -f 'vite|ts-node-dev'"
echo ""

# Keep script running
wait 