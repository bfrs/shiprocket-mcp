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

- Node (version > 20.0.0 and < 23.0.0)
- Claude Desktop app (or Cursor)

## 🛠️ Installation

### Using docker (Recommended)

Run this command to pull docker image

```bash
docker pull public.ecr.aws/h1j3j9q3/sr-mcp-repo:latest
```

Add the following to your `claude_desktop_config.json` (Claude Desktop) or `mcp.json` (Cursor)

```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "docker",
      "args": [
        "container",
        "run",
        "-i",
        "-e",
        "SELLER_EMAIL",
        "-e",
        "SELLER_PASSWORD",
        "public.ecr.aws/h1j3j9q3/sr-mcp-repo:latest"
      ],
      "env": {
        "SELLER_EMAIL": "<Your Shiprocket Email>",
        "SELLER_PASSWORD": "<Your Shiprocket password>"
      }
    }
  }
}
```

Restart your client (Claude-Desktop/Cursor) and the tools will reflect under "Shiprocket"

### Build from source

#### 1. Clone the Repository

```bash
git clone https://github.com/bfrs/shiprocket-mcp.git
cd shiprocket-mcp
```

#### 2. Install Dependencies using the existing package.json

```bash
# Install dependencies
npm install

# Build the binary
npm run build
```

#### 3. Connect to MCP server

Add the following to your `claude_desktop_config.json` or `mcp.json`

```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "npm",
      "args": ["--prefix", "{{PATH_TO_SRC}}", "start", "--silent"],
      "env": {
        "SELLER_EMAIL": "<Your Shiprocket Email>",
        "SELLER_PASSWORD": "<Your Shiprocket password>"
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

Open Claude Desktop and you should now see `Shiprocket` as an available integration.

Or restart Cursor.

## MCP Tools

Clients (Claude or Cursor) can access the following tools to interact with Shiprocket:

- `estimated_date_of_delivery` - To know more about the date of delivery for any location.
- `shipping_rate_calculator` - To check shippable couriers with their rates and coverage.
- `list_pickup_addresses` - List all the configured pickup addresses.
- `order_list` - Fetch recently created orders
- `order_track` - Track any order to know more about the current status of the order.
- `order_ship` - Ship an order to any serviceable courier partner based on the configured rules or specifying names.
- `order_pickup_schedule` - Schedule pickup of an order
- `generate_shipment_label` - Generate label of an order or shipment
- `order_cancel` - Cancel an order by providing order ID
- `order_create` - Create an order

## Examples:

- "Show me the fastest serviceable courier from Delhi to Banglore"
- "What are the courier options and delivery times from Delhi to Bangalore for a 0.5 KG COD package?"
- "Where is my order?"
- "How long will it take to deliver a package to Mumbai?"
