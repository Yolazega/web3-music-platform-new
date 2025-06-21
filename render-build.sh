#!/bin/bash
set -e

echo "🚀 Starting Render deployment build..."

# Set memory limit for Node.js to prevent OOM
export NODE_OPTIONS="--max-old-space-size=4096"

# Clean any previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist/ node_modules/.vite

# Install dependencies with timeout and retry
echo "📦 Installing dependencies..."
npm ci --prefer-offline --no-audit --no-fund --maxsockets 1

# Ensure Rollup dependencies are available
echo "🔧 Ensuring Rollup dependencies..."
npm ls @rollup/rollup-linux-x64-gnu || npm install @rollup/rollup-linux-x64-gnu --no-save

# Build TypeScript
echo "📝 Compiling TypeScript..."
npx tsc -b

# Build with Vite
echo "🏗️ Building with Vite..."
npx vite build --mode production

echo "✅ Build completed successfully!"
echo "📊 Build size:"
du -sh dist/ 