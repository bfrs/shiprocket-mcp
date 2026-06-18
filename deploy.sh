#!/bin/bash
set -e

echo "=== Shiprocket MCP Server Deployment Script ==="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt 20 ] || [ "$NODE_MAJOR" -ge 23 ]; then
    echo "ERROR: Node.js version must be >= 20.0.0 and < 23.0.0"
    echo "Current version: $NODE_VERSION"
    exit 1
fi

echo "✓ Node.js version: $NODE_VERSION"

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Build
echo "Building..."
npm run build

# Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Shiprocket credentials"
fi

# Create logs directory
mkdir -p logs

# Create data directory
mkdir -p data

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit .env and add your credentials"
echo "2. Run: npm start"
echo "3. Or use PM2: npm install -g pm2 && pm2 start dist/main.js --name shiprocket-mcp"
echo ""
echo "For Claude/Cursor integration, see: CONFIG.md"
