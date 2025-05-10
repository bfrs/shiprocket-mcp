# 🚀 Shiprocket MCP Integration

This is a Model Context Protocol (MCP) server for Shiprocket.

With this, you can:
- Check best and fastest serviceable courier partners(based on city or pincodes) and their shipping rates
- Create, update (single or bulk), and cancel orders
- Ship orders directly
- Track orders using the AWB number, Shiprocket Order ID, or Source Order ID

It connects to your personal Shiprocket account directly via Email and password.

### Here's an example of what you can do when it's connected to Claude.

---

## 🛠️ Prerequisites
- Node
- Claude Desktop app (or Cursor)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/bfrs/shiprocket-mcp.git
cd shiprocket-mcp
```

### 2. Install Dependencies using the existing package.json
```bash
npm install
```

### 3. Connect to MCP server
Copy the below json with the appropriate {{PATH}} values:

```bash
{
 "mcpServers": {
   "shiprocket": {
     "command": "node", // Run `which node` and place the output here
     "args": [
               "--directory",
               "{{PATH_TO_SRC}}", // cd into the repo, run `pwd` and enter the output here
               "run",
               "main.js"
     ],
     "env": {
       "USER_NAME":"Your Shiprocket Account email"
       "PASSWORD":"Your Shiprocket Account password"
     }
   }
 }
}
```

For Claude, save this as claude_desktop_config.json in your Claude Desktop configuration directory at:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```
For Cursor, save this as mcp.json in your Cursor configuration directory at:
```bash
~/.cursor/mcp.json
```

Open Claude Desktop and you should now see ``Shiprocket`` as an available integration.

Or restart Cursor.

## MCP Tools
Claude can access the following tools to interact with Shiprocket:

- `shipping_rate_calculator` - To check shipping rates and coverage
- `order_track` - Search for contacts by name or phone number
- `order_ship` - Ship an order
- `order_cancel` - Cancel an order by pxroving order ID

## Example Queries:
- "Show me fastest serviceable courier from Delhi to Banglore"
- "Help me to track my order for Order 928938367"
