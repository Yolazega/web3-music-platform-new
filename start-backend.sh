#!/bin/bash

# Backend Startup Script for AXEP Web3 Music Platform
echo "🔧 Starting AXEP Backend..."

# Ensure we're in the correct directory
cd "$(dirname "$0")/backend"
echo "📁 Current directory: $(pwd)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $(pwd)"
    echo "❌ Make sure the backend directory exists with package.json"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Kill any existing backend processes
echo "🔄 Stopping existing backend processes..."
pkill -f "ts-node-dev" 2>/dev/null || true
pkill -f "node.*index" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Create data directory if it doesn't exist
mkdir -p data

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "⚠️  Creating basic .env template..."
    cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
PINATA_JWT=your_pinata_jwt_here
DB_PATH=./data/db.json
FRONTEND_URL=http://localhost:3000
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e
TOKEN_CONTRACT_ADDRESS=0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4
EOF
    echo "📝 Please edit backend/.env and add your actual Pinata JWT token"
fi

# Set environment variables
export NODE_ENV=development
export PORT=3001

echo "🚀 Starting backend development server..."
echo "🌐 Backend will be available at: http://localhost:3001"
echo "📊 Health check: http://localhost:3001/health"
echo ""

# Start the development server
npm run dev 