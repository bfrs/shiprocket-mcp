#!/bin/bash
# Auto-Deploy Script for Aargo Lifestyle
# One-command production deployment
# Run: ./scripts/auto-deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Aargo Lifestyle Auto-Deploy ==="
echo ""

# Check Node.js
echo "🔍 Checking Node.js..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt 20 ] || [ "$NODE_MAJOR" -ge 23 ]; then
    echo "${RED}ERROR: Node.js must be >= 20.0.0 and < 23.0.0${NC}"
    exit 1
fi
echo "${GREEN}✓ Node.js: $NODE_VERSION${NC}"

# Check .env
echo "🔍 Checking .env..."
if [ ! -f .env ]; then
    echo "${RED}ERROR: .env not found${NC}"
    echo "Run: cp .env.example .env && edit with your credentials"
    exit 1
fi

if grep -q "SELLER_EMAIL=your-shiprocket-email" .env; then
    echo "${YELLOW}⚠️  .env has placeholder credentials${NC}"
    echo "Edit .env and add real Shiprocket email/password"
    exit 1
fi
echo "${GREEN}✓ .env: Configured${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build
echo "🔨 Building..."
npm run build

# Test
echo "🧪 Running tests..."
if npm test | grep -q "13 passed"; then
    echo "${GREEN}✓ All tests passed${NC}"
else
    echo "${RED}ERROR: Tests failed${NC}"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Start with PM2
echo "🚀 Deploying with PM2..."
if command -v pm2 &> /dev/null; then
    pm2 restart shiprocket-mcp || pm2 start dist/main.js --name shiprocket-mcp
    pm2 save
    echo "${GREEN}✓ PM2 process started${NC}"
else
    echo "${YELLOW}⚠️  PM2 not found. Starting with node...${NC}"
    echo "Install PM2: npm install -g pm2"
    nohup node dist/main.js > logs/server.log 2>&1 &
    echo "${GREEN}✓ Server started (PID: $!)${NC}"
fi

# Health check
echo "🔍 Health check..."
sleep 2
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo "${GREEN}✓ Server is healthy${NC}"
else
    echo "${YELLOW}⚠️  Server may not be responding yet${NC}"
fi

echo ""
echo "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "MCP Server: Running"
echo "Health: http://localhost:3000/health"
echo "Logs: pm2 logs shiprocket-mcp"
echo ""
echo "Next: Upload WooCommerce plugin to WordPress"
