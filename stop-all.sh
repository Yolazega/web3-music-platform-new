#!/bin/bash

# 🎵 AXEP Music Platform - Stop All Services
echo "🛑 Stopping AXEP Music Platform services..."
echo "==========================================="

# Function to stop a service by PID
stop_service() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🛑 Stopping $service_name (PID: $pid)..."
            kill "$pid"
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                echo "⚠️  Force killing $service_name..."
                kill -9 "$pid"
            fi
            echo "✅ $service_name stopped"
        else
            echo "⚠️  $service_name was not running"
        fi
        rm -f "$pid_file"
    else
        echo "⚠️  No PID file found for $service_name"
    fi
}

# Stop all services
stop_service ".backend.pid" "Backend Server"
stop_service ".web.pid" "Web Platform"
stop_service ".mobile.pid" "Mobile App"

# Also kill any remaining processes on common ports
echo ""
echo "🧹 Cleaning up any remaining processes..."

# Kill any process on port 3000 (Web)
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Cleaned up port 3000" || echo "ℹ️  Port 3000 was clean"

# Kill any process on port 3001 (Backend) 
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ Cleaned up port 3001" || echo "ℹ️  Port 3001 was clean"

# Kill any process on port 8081 (Expo)
lsof -ti:8081 | xargs kill -9 2>/dev/null && echo "✅ Cleaned up port 8081" || echo "ℹ️  Port 8081 was clean"

echo ""
echo "🎉 All AXEP services stopped successfully!"
echo "========================================" 