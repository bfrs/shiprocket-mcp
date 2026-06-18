# Progressive Implementation Plan: A → B → C
## Aargo Lifestyle × Shiprocket MCP Integration

**Prepared:** 2026-06-14  
**Version:** 1.0  
**Sequence:** Option A → Option B → Option C

---

## Overview

This plan implements Shiprocket MCP integration in 3 progressive phases:

| Phase | Option | What It Does | Effort | Value |
|-------|--------|--------------|--------|-------|
| **A** | AI Assistant | Claude/Cursor helps you manage shipping via natural language | 1 day | High |
| **B** | Website Integration | Customers see tracking, auto-sync orders from WooCommerce | 2-3 weeks | Very High |
| **C** | Full Automation | Both AI + website automation working together | 4-6 weeks | Maximum |

---

## PHASE A: AI Assistant (Option A)
**Timeline:** 1 day  
**Goal:** You ask Claude/Cursor to ship orders, track packages, check couriers — it happens

### What This Gives You

Instead of logging into Shiprocket dashboard and clicking around, you say:

- *"Show me all orders ready to ship"* → MCP fetches order list
- *"Ship order #4315612986 with Delhivery"* → MCP creates shipment
- *"Track AWB 19041929390673"* → MCP shows current status
- *"Check if pincode 560001 is serviceable"* → MCP checks coverage
- *"Generate label for order #3114459803"* → MCP creates label
- *"Show me pending NDRs"* → MCP lists delivery failures
- *"Reattempt delivery for undelivered order"* → MCP schedules reattempt

### Technical Setup

#### Step 1: Configure MCP Server
```bash
# In your shiprocket-mcp directory
cp .env.example .env
# Edit .env:
SELLER_EMAIL=devansh@aargolifestyle.com
SELLER_PASSWORD=your_password
PORT=3000
MCP_AUTH_TOKEN=generate_random_32_char_string
```

#### Step 2: Connect to Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "node",
      "args": ["/path/to/shiprocket-mcp/dist/main.js"],
      "env": {
        "SELLER_EMAIL": "devansh@aargolifestyle.com",
        "SELLER_PASSWORD": "your_password",
        "MCP_AUTH_TOKEN": "your_token"
      }
    }
  }
}
```

#### Step 3: Connect to Cursor
Edit `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "Shiprocket": {
      "command": "node",
      "args": ["/path/to/shiprocket-mcp/dist/main.js"],
      "env": {
        "SELLER_EMAIL": "devansh@aargolifestyle.com",
        "SELLER_PASSWORD": "your_password",
        "MCP_AUTH_TOKEN": "your_token"
      }
    }
  }
}
```

#### Step 4: Start Using

Open Claude/Cursor, you should see "Shiprocket" as a tool. Try:
- *"What are my recent orders?"*
- *"Check shipping rates for 560001"*
- *"Track my latest shipment"*

### What This Solves Immediately

| Problem | Before | After (Option A) |
|---------|--------|------------------|
| Check order status | Login → Orders → Search → Click | "Show me order status" |
| Track shipment | Login → Track → Enter AWB | "Track AWB 19041929390673" |
| Check courier prices | Login → Rate Calculator → Fill form | "Rates for 560001, 0.5kg" |
| Generate label | Login → Orders → Find → Generate Label | "Generate label for order #4315612986" |
| Handle NDR | Login → NDR → Find → Reattempt | "Show NDRs and reattempt" |

### Limitations (Why we need B)
- Still manual — you have to ask
- Customers can't see tracking themselves
- Orders still created manually in Shiprocket
- No website integration

---

## PHASE B: Website Integration (Option B)
**Timeline:** 2-3 weeks  
**Goal:** Your website talks to Shiprocket automatically

### What This Gives You

1. **Auto-Sync Orders**
   - Customer places order on aargolifestyle.com
   - Order automatically appears in Shiprocket
   - No manual copy-paste

2. **Customer Tracking Page**
   - Customer visits `/track-order`
   - Enters order ID or email
   - Sees real-time tracking
   - No more "Where is my order?" emails

3. **Auto-Ship**
   - Order marked "processing" in WooCommerce
   - Auto-ships in Shiprocket with cheapest courier
   - Label generated automatically
   - AWB stored in WooCommerce

4. **Auto-Update**
   - Shiprocket status changes → WooCommerce updates
   - Customer gets email: "Shipped", "Out for delivery", "Delivered"
   - No manual status updates

### Technical Implementation

#### Architecture
```
Customer Order → WooCommerce → Webhook → Your Plugin
                                        ↓
                                  Shiprocket MCP API
                                        ↓
                                  Shiprocket Dashboard
                                        ↓
                                  Tracking Updates
                                        ↓
                                  Customer Page
```

#### Components to Build

**1. WordPress Plugin: `aargo-shiprocket-connector`**
```
wp-content/plugins/aargo-shiprocket-connector/
├── aargo-shiprocket.php          # Main plugin
├── includes/
│   ├── class-mcp-client.php      # HTTP client to MCP server
│   ├── class-order-sync.php      # WooCommerce → Shiprocket sync
│   ├── class-tracking.php        # Tracking page handler
│   └── class-webhook.php         # Shiprocket → WooCommerce updates
├── admin/
│   └── settings.php              # Configuration page
├── public/
│   └── tracking-page.php         # Customer tracking UI
└── assets/
    └── tracking.js               # Real-time status updates
```

**2. MCP Client (PHP)**
```php
class Aargo_MCP_Client {
    private $mcp_url;
    private $auth_token;
    
    public function call_tool($tool_name, $arguments) {
        // HTTP POST to MCP server
        // Auth: Bearer token
        // Returns: Shiprocket API response
    }
}
```

**3. Order Sync (WooCommerce → Shiprocket)**
```php
// Hook: When order status changes to 'processing'
add_action('woocommerce_order_status_processing', 'aargo_sync_to_shiprocket');

function aargo_sync_to_shiprocket($order_id) {
    $order = wc_get_order($order_id);
    
    // Build Shiprocket payload
    $payload = [
        'order_id' => $order->get_order_number(),
        'order_date' => $order->get_date_created(),
        'billing_customer_name' => $order->get_billing_first_name(),
        'billing_address' => $order->get_billing_address_1(),
        'billing_city' => $order->get_billing_city(),
        'billing_pincode' => $order->get_billing_postcode(),
        'billing_state' => $order->get_billing_state(),
        'billing_email' => $order->get_billing_email(),
        'billing_phone' => $order->get_billing_phone(),
        'order_items' => [],
        'payment_method' => $order->get_payment_method() === 'cod' ? 'COD' : 'Prepaid',
        'sub_total' => $order->get_subtotal(),
        'weight' => 0.5,  // Default, customize per product
        'length' => 10,
        'breadth' => 10,
        'height' => 10,
    ];
    
    // Call MCP tool: order_create
    $mcp = new Aargo_MCP_Client();
    $result = $mcp->call_tool('order_create', $payload);
    
    // Store Shiprocket order ID in WooCommerce meta
    $order->update_meta_data('_shiprocket_order_id', $result['order_id']);
    $order->save();
}
```

**4. Auto-Ship (After Order Creation)**
```php
// After order created in Shiprocket, auto-ship
function aargo_auto_ship($shiprocket_order_id) {
    $mcp = new Aargo_MCP_Client();
    
    // Get best courier
    $couriers = $mcp->call_tool('shipping_rate_calculator', [
        'pickup_postcode' => '110001',  // Your warehouse
        'delivery_postcode' => $order->get_billing_postcode(),
        'weight' => 0.5,
        'cod' => $order->get_payment_method() === 'cod'
    ]);
    
    // Select cheapest courier
    $best_courier = $couriers[0];  // Already sorted by price
    
    // Ship order
    $ship_result = $mcp->call_tool('order_ship', [
        'order_id' => $shiprocket_order_id,
        'courier_name' => $best_courier['courier_name']
    ]);
    
    // Store AWB
    $order->update_meta_data('_awb_number', $ship_result['awb']);
    $order->update_meta_data('_courier_name', $best_courier['courier_name']);
    $order->save();
    
    // Generate label
    $label = $mcp->call_tool('generate_shipment_label', [
        'shipment_id' => $ship_result['shipment_id']
    ]);
    
    $order->update_meta_data('_label_url', $label['label_url']);
    $order->save();
}
```

**5. Customer Tracking Page**
```php
// Shortcode: [aargo_tracking]
function aargo_tracking_shortcode() {
    // Form: Enter order ID or email
    // Query: Get order from WooCommerce
    // Display: Tracking timeline with Shiprocket status
    // Call MCP: order_track with AWB
}
```

**6. Webhook Handler (Shiprocket → WooCommerce)**
```php
// Endpoint: /wp-json/aargo/v1/shiprocket-webhook
add_action('rest_api_init', function() {
    register_rest_route('aargo/v1', '/shiprocket-webhook', [
        'methods' => 'POST',
        'callback' => 'aargo_handle_shiprocket_webhook',
    ]);
});

function aargo_handle_shiprocket_webhook($request) {
    $data = $request->get_json_params();
    $awb = $data['awb'];
    $status = $data['current_status'];
    
    // Find WooCommerce order by AWB
    $order_id = aargo_get_order_by_awb($awb);
    $order = wc_get_order($order_id);
    
    // Update status
    switch($status) {
        case 'SHIPPED':
            $order->update_status('shipped');
            // Send email
            break;
        case 'OUT FOR DELIVERY':
            $order->add_order_note('Out for delivery today');
            break;
        case 'DELIVERED':
            $order->update_status('completed');
            break;
        case 'UNDELIVERED':
            $order->add_order_note('Delivery failed - NDR created');
            break;
    }
}
```

### Developer Roles for Phase B

| Role | Task | Time |
|------|------|------|
| **Backend Dev** | WordPress plugin, MCP client, order sync | 1.5 weeks |
| **Frontend Dev** | Tracking page UI, admin dashboard | 1 week |
| **DevOps** | MCP server deployment, SSL, security | 0.5 weeks |
| **QA** | Test with real orders, validate data flow | 0.5 weeks |

### Deliverables
- [ ] WooCommerce plugin installed and activated
- [ ] Orders auto-sync to Shiprocket
- [ ] Auto-shipping with cheapest courier
- [ ] Customer tracking page live
- [ ] Status update emails working
- [ ] Admin can see Shiprocket status in WooCommerce

---

## PHASE C: Full Automation (Option C)
**Timeline:** 4-6 weeks (includes A + B + advanced features)

### What This Gives You

**Everything from A + B, plus:**

1. **AI Assistant + Website Combined**
   - You ask: "Ship my latest orders" → AI ships them
   - Customer gets tracking automatically
   - No manual steps

2. **Smart Courier Selection**
   - AI learns which couriers are best for each pincode
   - Auto-selects based on: price, speed, reliability
   - You can override via AI: "Ship with Delhivery only"

3. **Proactive NDR Handling**
   - Failed delivery detected
   - AI asks you: "NDR for order #123 - reattempt or RTO?"
   - You reply: "Reattempt" → AI handles it
   - Customer gets SMS with resolution

4. **Returns & Exchanges**
   - Customer requests return on website
   - AI creates return in Shiprocket
   - Customer gets return label
   - Refund processed automatically

5. **Analytics Dashboard**
   - Shipping cost trends
   - Courier performance comparison
   - Delivery success rates
   - NDR analysis

6. **Bulk Operations**
   - "Ship all pending orders" → AI ships everything
   - "Generate manifest for today's pickups" → Done
   - "Download all labels for tomorrow" → Done

### Advanced Features

**1. AI-Powered Queries**
```
"Show me orders from Bangalore that haven't shipped yet"
→ AI filters: orders with pincode 560xxx, status = pending

"What's the cheapest courier to Mumbai for 1kg?"
→ AI calls rate calculator, sorts by price

"Why did order #123 fail delivery?"
→ AI checks NDR reason, explains

"Compare Delhivery vs Ekart for pincode 400001"
→ AI fetches both rates, shows comparison
```

**2. Automated Workflows**
```
Every day at 6 PM:
  1. Find all orders with status "ready_to_ship"
  2. Get best courier for each
  3. Ship all orders
  4. Generate labels
  5. Send email to ops team

When NDR created:
  1. Check reason
  2. If "customer not available" → Auto-reattempt
  3. If "wrong address" → Flag for manual review
  4. Email customer with options

When order delivered:
  1. Update WooCommerce status
  2. Send "Thank you" email
  3. Request review after 3 days
```

**3. Voice/Chat Commands**
```
WhatsApp: "Track my order 12345"
→ Bot: "Your order is out for delivery. Expected today by 6 PM."

Slack: "Ship all pending orders"
→ Bot: "Shipped 5 orders. AWBs: 19041..., 19042..., ..."

Email: "Generate manifest for tomorrow"
→ Bot: "Manifest generated: https://..."
```

### Complete Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     USER INTERFACES                      │
├─────────────────────────────────────────────────────────┤
│  Claude/Cursor    │  WhatsApp/Slack   │  Website        │
│  (AI Assistant)   │  (Chat Bot)       │  (Customer)     │
└────────┬──────────┴────────┬──────────┴────────┬────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │         MCP SERVER (Node.js)           │
         │  ┌─────────────────────────────────┐   │
         │  │  24 Tools: orders, shipping,    │   │
         │  │  tracking, NDR, returns, etc.   │   │
         │  └─────────────────────────────────┘   │
         └───────────────────┬───────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │      WORDPRESS PLUGIN (PHP)            │
         │  ┌─────────────────────────────────┐   │
         │  │  WooCommerce hooks, webhooks,   │   │
         │  │  tracking page, admin dashboard   │   │
         │  └─────────────────────────────────┘   │
         └───────────────────┬───────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │          SHIPROCKET API              │
         │      (apiv2.shiprocket.in)         │
         └─────────────────────────────────────┘
```

---

## Implementation Schedule

| Week | Phase | Task | Owner |
|------|-------|------|-------|
| **Week 1** | A | Deploy MCP server, connect to Claude/Cursor | DevOps |
| **Week 1** | A | Test all 24 tools with real data | QA |
| **Week 2** | B | Build WordPress plugin scaffold | Backend |
| **Week 2** | B | Implement MCP client in PHP | Backend |
| **Week 3** | B | Build order sync (WC → Shiprocket) | Backend |
| **Week 3** | B | Build auto-ship logic | Backend |
| **Week 4** | B | Build customer tracking page | Frontend |
| **Week 4** | B | Build webhook handler (SR → WC) | Backend |
| **Week 5** | C | Implement smart courier selection | Backend |
| **Week 5** | C | Build NDR automation | Backend |
| **Week 6** | C | Build analytics dashboard | Frontend |
| **Week 6** | C | End-to-end testing, UAT | QA |

---

## Cost Analysis

| Item | Cost | Notes |
|------|------|-------|
| MCP Server Hosting | ₹500/month | VPS, 1GB RAM |
| Shiprocket API | Free | Included in seller plan |
| WordPress Plugin Dev | ₹30,000 | One-time |
| DevOps Setup | ₹10,000 | One-time |
| SSL Certificate | Free | Let's Encrypt |
| **Total Setup** | **₹40,000** | One-time |
| **Monthly** | **₹500** | Server only |

---

## Success Metrics

| Metric | Before | After Phase A | After Phase B | After Phase C |
|--------|--------|----------------|---------------|---------------|
| Time to ship order | 10 min | 5 min | 0 min | 0 min |
| Customer tracking queries | 20/day | 20/day | 2/day | 0/day |
| Manual data entry | 100% | 100% | 0% | 0% |
| Shipping cost optimization | Manual | Manual | Auto | AI-optimized |
| NDR response time | 24h | 12h | 4h | 1h |

---

## Next Steps

### Start Phase A (This Week)

1. **Today:**
   - [ ] Deploy MCP server on your server
   - [ ] Add your Shiprocket credentials to `.env`
   - [ ] Connect to Claude/Cursor
   - [ ] Test: "Show me my orders"

2. **Tomorrow:**
   - [ ] Test all 24 tools
   - [ ] Document which tools you use most
   - [ ] Share with your team

### Questions for You

1. **Do you want to start Phase A today?** (Deploy MCP server, connect to Claude)
2. **Do you have a developer for Phase B?** (WordPress plugin development)
3. **What's your current WooCommerce setup?** (Version, hosting, any existing shipping plugins)
4. **Do you use COD or prepaid mostly?** (From your dashboard: both orders are COD)
5. **Any specific courier preference?** (Delhivery, Ekart, etc.)

---

**Ready to start?** Say "Start Phase A" and I'll deploy the MCP server.
