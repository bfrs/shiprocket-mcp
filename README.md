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

### 1. Clone the Repository
```bash
git clone https://github.com/bfrs/shiprocket-mcp.git
cd shiprocket-mcp
```

### 2. Install Dependencies using the existing package.json
```bash
# Install dependencies
npm install

# Build the binary
npm run build
```

### 3. Connect to MCP server
Add the following to your `claude_desktop_config.json` or `mcp.json`

```bash
{
 "mcpServers": {
   "Shiprocket": {
     "command": "npm",
      "args": [
        "--prefix",
        "{{PATH_TO_SRC}}",
        "start",
        "--silent"
      ],
      "env": {
       "SELLER_EMAIL":"<Your Shiprocket Email>",
       "SELLER_PASSWORD":"<Your Shiprocket password>"
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

## Running as a remote (HTTP + OAuth) server

Instead of every user running a local copy with their password in a config file, the
server can be hosted once and sellers connect by URL. Clients (Claude.ai, ChatGPT, Claude
Code, Cursor) discover the OAuth endpoints automatically and open a browser login.

```bash
cp .env.example .env            # then fill in the HTTP section
npm run build && npm run start:http
# or: docker compose up
```

| Variable | Required | Purpose |
|---|---|---|
| `OAUTH_ISSUER` | production | Public base URL, e.g. `https://mcp.example.com` |
| `TOKEN_ENC_KEY` | production | Base64 32-byte key; seller tokens are AES-256-GCM encrypted in Redis. Generate with `openssl rand -base64 32`. Rotating it invalidates every stored token (sellers re-login). |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_TLS` | production | Token store. Without `REDIS_HOST` an in-memory store is used (development only). |

Endpoints: `/.well-known/oauth-authorization-server`, `/oauth/register` (DCR),
`/oauth/authorize`, `/oauth/consent`, `/oauth/token`, `/oauth/revoke` (RFC 7009 — revoking
either token of a pair invalidates both and closes any live MCP session), `/mcp`.

### Consent and scopes

Authorization is **consent → login**. The seller first sees which application is asking
(its registered `client_name` and redirect host) and exactly what it will be allowed to do,
with Allow / Deny; only after Allow are they asked for Shiprocket credentials. The forms carry
a single opaque `txn`; all OAuth parameters stay server-side.

| Scope | Grants | Tools |
|---|---|---|
| `seller:read` *(default)* | read-only access | `estimated_delivery`, `order_track`, `order_list`, `shipping_rate_calculator`, `list_pickup_addresses`, `generate_shipment_label` |
| `seller:write` | create / ship / cancel | `order_ship`, `order_schedule_pickup`, `order_cancel`, `order_create` |

A client that requests no `scope` gets `seller:read` only. Tools outside the granted scope are
not listed to the client and are refused with `insufficient_scope` if called anyway. In stdio
mode (seller's own credentials) every scope is implied.

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
