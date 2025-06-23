#!/bin/bash

# 🎵 AXEP Music Platform - Start All Services
echo "🎵 Starting AXEP Music Platform..."
echo "=================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start Backend
echo "🔗 Starting Backend Server..."
cd web3-music-platform-new/backend
if [ -f "package.json" ]; then
    npm install > /dev/null 2>&1
    npm run dev &
    BACKEND_PID=$!
    echo "✅ Backend started on http://localhost:3001 (PID: $BACKEND_PID)"
else
    echo "⚠️  Backend package.json not found, skipping backend"
fi
cd ../..

# Start Web Platform
echo "🌐 Starting Web Platform..."
cd web3-music-platform-new
npm install > /dev/null 2>&1
npm run dev &
WEB_PID=$!
echo "✅ Web platform started on http://localhost:3000 (PID: $WEB_PID)"
cd ..

# Start Mobile App
echo "📱 Starting Mobile App..."
cd axep-mobile-app
npm install > /dev/null 2>&1
npm start &
MOBILE_PID=$!
echo "✅ Mobile app started with Expo (PID: $MOBILE_PID)"
cd ..

echo ""
echo "🎉 All services started successfully!"
echo "=================================="
echo "🌐 Web Platform: http://localhost:3000"
echo "🔗 Backend API: http://localhost:3001"
echo "📱 Mobile App: Expo development server running"
echo ""
echo "📱 To test mobile app:"
echo "   • Install Expo Go on your phone"
echo "   • Scan the QR code shown in terminal"
echo "   • Or press 'w' to open in web browser"
echo ""
echo "⚠️  To stop all services, run: ./scripts/stop-all.sh"
echo "   Or press Ctrl+C and then run the stop script"

# Save PIDs for stopping later
echo "$BACKEND_PID" > .backend.pid
echo "$WEB_PID" > .web.pid
echo "$MOBILE_PID" > .mobile.pid

# Wait for user input
echo ""
echo "Press Ctrl+C to stop all services..."
wait 