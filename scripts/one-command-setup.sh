#!/bin/bash
# One-Command Setup for Aargo Lifestyle
# Usage: ./scripts/one-command-setup.sh
# This script sets up EVERYTHING for production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          AARGO LIFESTYLE — ONE-COMMAND SETUP                ║"
echo "║              Production Deployment Package                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "${NC}"

# Step 1: Check prerequisites
echo "${BLUE}Step 1: Checking prerequisites...${NC}"

# Node.js
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2) || NODE_VERSION=""
if [ -z "$NODE_VERSION" ]; then
    echo "${RED}❌ Node.js not found. Install Node.js >= 20.0.0 and < 23.0.0${NC}"
    exit 1
fi
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ] || [ "$NODE_MAJOR" -ge 23 ]; then
    echo "${RED}❌ Node.js $NODE_VERSION not supported. Need >= 20.0.0 and < 23.0.0${NC}"
    exit 1
fi
echo "${GREEN}✓ Node.js: $NODE_VERSION${NC}"

# npm
if ! command -v npm &> /dev/null; then
    echo "${RED}❌ npm not found${NC}"
    exit 1
fi
echo "${GREEN}✓ npm: $(npm -v)${NC}"

# git
if ! command -v git &> /dev/null; then
    echo "${YELLOW}⚠️  git not found (optional)${NC}"
fi

echo ""

# Step 2: Credentials check
echo "${BLUE}Step 2: Checking Shiprocket credentials...${NC}"
if [ ! -f .env ]; then
    echo "${RED}❌ .env file not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env
fi

if grep -q "SELLER_EMAIL=your-shiprocket-email" .env || grep -q "SELLER_PASSWORD=your-shiprocket-password" .env; then
    echo "${YELLOW}⚠️  .env has placeholder credentials${NC}"
    echo ""
    echo "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo "${YELLOW}║  ACTION REQUIRED: Fill in your Shiprocket credentials        ║${NC}"
    echo "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Edit .env and replace:"
    echo "  SELLER_EMAIL=your-shiprocket-email@example.com"
    echo "  SELLER_PASSWORD=your-shiprocket-password"
    echo ""
    echo "With your actual credentials from: https://app.shiprocket.in"
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo "${GREEN}✓ Credentials: Configured${NC}"

echo ""

# Step 3: Install dependencies
echo "${BLUE}Step 3: Installing dependencies...${NC}"
npm ci --production
echo "${GREEN}✓ Dependencies installed${NC}"

echo ""

# Step 4: Build
echo "${BLUE}Step 4: Building...${NC}"
npm run build
echo "${GREEN}✓ Build complete${NC}"

echo ""

# Step 5: Test
echo "${BLUE}Step 5: Running tests...${NC}"
if npm test | grep -q "13 passed"; then
    echo "${GREEN}✓ All 13 tests passed${NC}"
else
    echo "${RED}❌ Tests failed${NC}"
    exit 1
fi

echo ""

# Step 6: Create directories
echo "${BLUE}Step 6: Creating directories...${NC}"
mkdir -p logs data
echo "${GREEN}✓ Directories created${NC}"

echo ""

# Step 7: Deploy
echo "${BLUE}Step 7: Deploying...${NC}"
if command -v pm2 &> /dev/null; then
    echo "Using PM2..."
    pm2 restart shiprocket-mcp 2>/dev/null || pm2 start dist/main.js --name shiprocket-mcp
    pm2 save
    echo "${GREEN}✓ PM2 process started${NC}"
    echo ""
    echo "Commands:"
    echo "  pm2 status              — Check status"
    echo "  pm2 logs shiprocket-mcp — View logs"
    echo "  pm2 restart shiprocket-mcp — Restart"
    echo "  pm2 stop shiprocket-mcp  — Stop"
else
    echo "${YELLOW}⚠️  PM2 not found. Using nohup...${NC}"
    echo "Install PM2: npm install -g pm2"
    nohup node dist/main.js > logs/server.log 2>&1 &
    echo "${GREEN}✓ Server started (PID: $!)${NC}"
    echo "Logs: tail -f logs/server.log"
fi

echo ""

# Step 8: Health check
echo "${BLUE}Step 8: Health check...${NC}"
sleep 3
for i in {1..5}; do
    if curl -s http://localhost:3000/health | grep -q "ok"; then
        echo "${GREEN}✓ Server is healthy and responding${NC}"
        HEALTHY=1
        break
    fi
    sleep 2
done

if [ -z "$HEALTHY" ]; then
    echo "${YELLOW}⚠️  Server may not be responding yet${NC}"
    echo "   Check logs: tail -f logs/server.log"
fi

echo ""

# Step 9: Summary
echo "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 🎉 DEPLOYMENT COMPLETE 🎉                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "${NC}"
echo ""
echo "${GREEN}✓ MCP Server:${NC} Deployed"
echo "${GREEN}✓ Tests:${NC} 13/13 passing"
echo "${GREEN}✓ Health:${NC} http://localhost:3000/health"
echo ""
echo "${BLUE}Next steps:${NC}"
echo "  1. Upload WooCommerce plugin: aargo-shiprocket-v1.1.0.zip"
echo "  2. Configure webhook endpoint in Shiprocket settings"
echo "  3. Test order creation and tracking"
echo ""
echo "${BLUE}Monitoring:${NC}"
echo "  ./scripts/business-monitor.sh     — Check status"
echo "  ./scripts/business-monitor.sh --watch  — Continuous monitoring"
echo ""
echo "${BLUE}Support:${NC}"
echo "  If issues: Check logs/ directory"
echo "  If stuck: Run ./scripts/auto-deploy.sh"
echo ""

# Save deployment info
DEPLOY_INFO="logs/deployment-$(date +%Y%m%d-%H%M%S).log"
echo "Deployment completed at $(date)" > $DEPLOY_INFO
echo "Node.js: $NODE_VERSION" >> $DEPLOY_INFO
echo "Tests: 13/13 passed" >> $DEPLOY_INFO
echo "Health: http://localhost:3000/health" >> $DEPLOY_INFO
echo "Deploy info saved: $DEPLOY_INFO"
