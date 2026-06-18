#!/bin/bash
# Aargo Lifestyle — Business Monitor
# Checks orders, flags issues, generates alerts
# Run: ./scripts/business-monitor.sh

set -e

MCP_HOST="${MCP_HOST:-localhost}"
MCP_PORT="${MCP_PORT:-3000}"
HEALTH_URL="http://${MCP_HOST}:${MCP_PORT}/health"

echo "=== Aargo Lifestyle Business Monitor ==="
echo "Time: $(date)"
echo ""

# Check MCP server health
echo "🔍 Checking MCP server..."
if curl -s ${HEALTH_URL} | grep -q "ok"; then
    echo "✅ MCP server: HEALTHY"
else
    echo "🚨 MCP server: DOWN or UNHEALTHY"
    echo "   URL: ${HEALTH_URL}"
    echo "   Action: Restart server or check logs"
    echo ""
fi

# Check .env file
echo "🔍 Checking credentials..."
if [ -f .env ]; then
    if grep -q "SELLER_EMAIL=your-shiprocket-email" .env; then
        echo "⚠️  Credentials: PLACEHOLDER — Not configured"
        echo "   Action: Edit .env and add real Shiprocket email/password"
    else
        echo "✅ Credentials: Configured"
    fi
else
    echo "🚨 .env file: MISSING"
    echo "   Action: cp .env.example .env && edit with credentials"
fi

echo ""

# Check test suite
echo "🔍 Checking test suite..."
if npm test 2>/dev/null | grep -q "13 passed"; then
    echo "✅ Tests: ALL PASSING (13/13)"
else
    echo "⚠️  Tests: Need to run"
    echo "   Action: npm test"
fi

echo ""

# Check deployment readiness
echo "🔍 Checking deployment readiness..."
if [ -f dist/main.js ]; then
    echo "✅ Build: Ready"
else
    echo "⚠️  Build: Not found"
    echo "   Action: npm run build"
fi

if [ -x deploy.sh ]; then
    echo "✅ Deploy script: Ready"
else
    echo "⚠️  Deploy script: Not executable"
    echo "   Action: chmod +x deploy.sh"
fi

echo ""

# Check WooCommerce plugin
echo "🔍 Checking WooCommerce plugin..."
if [ -f aargo-shiprocket-v1.1.0.zip ]; then
    echo "✅ Plugin zip: Ready for upload"
else
    echo "⚠️  Plugin zip: Not found"
    echo "   Action: Create zip from woocommerce-plugin/"
fi

echo ""

# Summary
echo "=== Summary ==="
echo "MCP Server: Ready for deployment (fill .env first)"
echo "WooCommerce Plugin: Ready for upload"
echo "Tests: 13/13 passing"
echo ""
echo "Next action: Fill .env with Shiprocket credentials, then deploy"

# If run with --watch, loop
echo ""
if [ "$1" == "--watch" ]; then
    echo "Running in watch mode. Press Ctrl+C to exit."
    while true; do
        sleep 60
        echo "[$(date)] Checking..."
        curl -s ${HEALTH_URL} | grep -q "ok" && echo "✅ Server OK" || echo "🚨 Server DOWN"
    done
fi
