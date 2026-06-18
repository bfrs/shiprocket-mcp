# Claude/Cursor Configuration Guide
## Option A: AI Assistant Setup

### Step 1: Build the MCP Server

```bash
# From the shiprocket-mcp directory
npm install
npm run build
```

### Step 2: Configure Environment

Create `.env` file:
```bash
cp .env.example .env
# Edit with your credentials
```

Your `.env`:
```
SELLER_EMAIL=your-email@example.com
SELLER_PASSWORD=your-password
PORT=3000
MCP_AUTH_TOKEN=$(openssl rand -hex 32)
```

### Step 3: Start the Server

```bash
# Option A: Direct
npm start

# Option B: PM2 (recommended for production)
npm install -g pm2
pm2 start dist/main.js --name shiprocket-mcp
pm2 save
pm2 startup
```

### Step 4: Connect to Claude Desktop

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "node",
      "args": ["/path/to/shiprocket-mcp/dist/main.js"],
      "env": {
        "SELLER_EMAIL": "your-email@example.com",
        "SELLER_PASSWORD": "your-password",
        "MCP_AUTH_TOKEN": "your-token",
        "PORT": "3000"
      }
    }
  }
}
```

**For STDIO mode (default):** Use above config.

**For HTTP mode:** Add `"--http"` to args or set `MCP_TRANSPORT=HTTP`.

### Step 5: Connect to Cursor

Edit: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "node",
      "args": ["/path/to/shiprocket-mcp/dist/main.js"],
      "env": {
        "SELLER_EMAIL": "your-email@example.com",
        "SELLER_PASSWORD": "your-password",
        "MCP_AUTH_TOKEN": "your-token",
        "PORT": "3000"
      }
    }
  }
}
```

### Step 6: Verify Connection

Restart Claude/Cursor. You should see "Shiprocket" in the tools list.

Test:
- "Show me my orders"
- "Check shipping rates for pincode 560001"
- "Track my latest shipment"

### Troubleshooting

**Error: "Cannot find module"**
- Run `npm run build` first
- Check `dist/main.js` exists

**Error: "Authentication failed"**
- Check SELLER_EMAIL and SELLER_PASSWORD in .env
- Verify credentials work on app.shiprocket.in

**Error: "Port already in use"**
- Change PORT in .env
- Or kill existing process: `lsof -ti:3000 | xargs kill`

**Server not responding**
- Check logs: `pm2 logs shiprocket-mcp`
- Verify health: `curl http://localhost:3000/health`

### Available Commands

Once connected, you can ask:

| Command | What It Does |
|---------|--------------|
| "Show my orders" | Lists all orders from Shiprocket |
| "Track order [ID]" | Shows tracking status |
| "Ship order [ID] with [courier]" | Creates shipment |
| "Check rates for pincode [PIN]" | Gets courier rates |
| "Generate label for [ID]" | Creates shipping label |
| "Show NDRs" | Lists delivery failures |
| "Reattempt delivery for [ID]" | Schedules reattempt |
| "Create return for [ID]" | Initiates return |
| "List pickup addresses" | Shows your warehouses |
| "Get manifest for today" | Generates daily manifest |

### Security Notes

- Keep MCP_AUTH_TOKEN secret
- Use strong token: `openssl rand -hex 32`
- Don't commit .env to git
- Use IP whitelist if deploying publicly
- Enable HTTPS for production

### Next Steps

After Option A works, proceed to:
- **Option B**: Website integration (WooCommerce plugin)
- **Option C**: Full automation (both + advanced features)

See PROGRESSIVE_PLAN.md for details.
