#!/bin/bash

# Frontend Startup Script for AXEP Web3 Music Platform
echo "🎵 Starting AXEP Frontend..."

# Ensure we're in the correct directory
cd "$(dirname "$0")"
echo "📁 Current directory: $(pwd)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $(pwd)"
    echo "❌ Make sure you're running this from the web3-music-platform-new directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing processes on port 3000
echo "🔄 Checking for existing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Set environment variables
export NODE_ENV=development

echo "🚀 Starting Vite development server..."
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔗 Make sure backend is running on port 3001"
echo ""

# Start the development server
npm run dev 