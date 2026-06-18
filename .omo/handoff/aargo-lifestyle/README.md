# Aargo Lifestyle × Shiprocket MCP Integration
## Developer Handoff Document

**Prepared:** 2026-06-14  
**Version:** 1.0  
**Status:** Ready for Development  
**Project:** Full Order Management Integration  

---

## 1. Executive Summary

This document provides a complete implementation roadmap for integrating Aargo Lifestyle's WooCommerce store with Shiprocket's logistics platform using the Model Context Protocol (MCP) server. The goal is to automate the entire order lifecycle: from customer purchase → courier selection → shipping → tracking → returns handling.

### Business Value
- **Reduce manual shipping operations** by 80%
- **Real-time order tracking** for customer support
- **Automated courier selection** based on cost/speed
- **Streamlined returns & NDR management**
- **Label & manifest generation** without manual data entry

---

## 2. Current State Analysis

### Aargo Lifestyle Tech Stack
- **Platform:** WordPress + WooCommerce (confirmed via WordPress headers)
- **Products:** Hair Serum, Face Wash, Face Serum (₹199-₹399 price range)
- **Shipping:** Free shipping on orders > ₹500, pan-India delivery
- **Current Shipping:** Likely manual or basic plugin-based

### Shiprocket MCP Server Capabilities
The MCP server exposes **24 tools** across 8 categories:

| Category | Tools | Purpose |
|----------|-------|---------|
| **Serviceability** | `estimated_delivery`, `shipping_rate_calculator` | Check delivery feasibility and costs |
| **Orders** | `order_list`, `order_create`, `get_order_detail` | Manage order lifecycle |
| **Shipping** | `order_ship`, `order_schedule_pickup`, `order_track` | Execute shipping operations |
| **Settings** | `list_pickup_addresses` | Configuration management |
| **NDR** | `list_ndr`, `get_ndr`, `reattempt_ndr`, `mark_rto`, `contact_buyer` | Handle delivery exceptions |
| **Returns** | `list_returns`, `create_return`, `create_exchange`, `update_return`, `cancel_return` | Reverse logistics |
| **Manifest** | `generate_manifest`, `print_manifest` | Bulk shipping documentation |
| **Invoice** | `generate_invoice` | Financial documentation |

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Aargo Lifestyle Website                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  Customer   │  │   Admin     │  │  Order Tracking │   │
│  │  Frontend   │  │  Dashboard  │  │      Page       │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
└─────────┼────────────────┼──────────────────┼────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 WooCommerce (WordPress)                       │
│  • Order webhooks (order.created, order.updated)             │
│  • Custom meta fields for AWB, courier, tracking             │
│  • REST API endpoints for external integration                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Shiprocket MCP Server (Node.js)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Transport Layer: HTTP (port 3000) or STDIO              │ │
│  │  Auth: SELLER_EMAIL + SELLER_PASSWORD (Shiprocket)      │ │
│  │  Session Management: Per-connection with TTL cleanup   │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shiprocket API                             │
│              (apiv2.shiprocket.in)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Phased Implementation Plan

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic connectivity and order synchronization

#### 1.1 MCP Server Deployment
- [ ] Deploy MCP server on Aargo's infrastructure (VPS/Cloud)
- [ ] Configure environment variables:
  ```
  SELLER_EMAIL=<shiprocket_email>
  SELLER_PASSWORD=<shiprocket_password>
  PORT=3000
  MCP_AUTH_TOKEN=<strong_random_token>
  ```
- [ ] Verify server health at `GET /health`
- [ ] Test MCP initialization via HTTP client

#### 1.2 WooCommerce Integration
- [ ] Create custom WordPress plugin: `aargo-shiprocket-integration`
- [ ] Add Shiprocket configuration page in WP Admin
- [ ] Store MCP server URL and auth token in WP options
- [ ] Implement WooCommerce webhook handler for `order.created` events

#### 1.3 Order Creation Flow
- [ ] Map WooCommerce order → Shiprocket order payload
- [ ] Handle address parsing (billing/shipping)
- [ ] Product weight/dimension mapping (critical for shipping rates)
- [ ] Create order in Shiprocket on WC order status = `processing`

**Deliverable:** Orders placed on Aargo automatically sync to Shiprocket

---

### Phase 2: Shipping Automation (Week 3-4)
**Goal:** Automated courier selection, shipping, and label generation

#### 2.1 Courier Selection
- [ ] Implement `shipping_rate_calculator` before shipping
- [ ] Filter couriers by:
  - Cost (lowest first)
  - Speed (fastest first)
  - COD availability (if applicable)
  - Coverage (pincode serviceability)
- [ ] Store selected courier in WC order meta

#### 2.2 Automated Shipping
- [ ] Trigger `order_ship` on order creation (or admin approval)
- [ ] Handle pickup address selection from `list_pickup_addresses`
- [ ] Store AWB number in WC order meta (`_awb_number`)
- [ ] Update WC order status → `shipped`

#### 2.3 Label Generation
- [ ] Call `generate_shipment_label` after shipping
- [ ] Store label URL in WC order meta
- [ ] Make label downloadable from admin order page
- [ ] Auto-print option for bulk operations

#### 2.4 Pickup Scheduling
- [ ] Implement `order_schedule_pickup` for orders
- [ ] Store pickup date/time in WC order meta
- [ ] Email notification to operations team

**Deliverable:** Complete hands-off shipping from order to label

---

### Phase 3: Customer Experience (Week 5-6)
**Goal:** Real-time tracking and customer self-service

#### 3.1 Order Tracking Page
- [ ] Create customer-facing tracking page: `/order-tracking`
- [ ] Accept order ID or email lookup
- [ ] Query `order_track` via MCP server
- [ ] Display tracking timeline with status history
- [ ] Show estimated delivery date from `estimated_delivery`

#### 3.2 Admin Dashboard Widget
- [ ] Add Shiprocket status widget to WC admin order page
- [ ] Real-time tracking status without page refresh
- [ ] Quick actions: refresh tracking, download label, print manifest

#### 3.3 Customer Notifications
- [ ] Webhook handler for Shiprocket status updates
- [ ] Trigger WC emails on status changes:
  - `shipped` → "Your order is on the way"
  - `out_for_delivery` → "Out for delivery today"
  - `delivered` → "Delivered!"
  - `ndr` → "Delivery issue - action needed"

**Deliverable:** Customers can track orders in real-time

---

### Phase 4: Exception Handling (Week 7-8)
**Goal:** Handle delivery failures, returns, and exchanges

#### 4.1 NDR Management
- [ ] Monitor NDR (Non-Delivery Report) via `list_ndr`
- [ ] Admin dashboard for NDR actions:
  - `reattempt_ndr` - Schedule re-delivery
  - `mark_rto` - Mark for Return to Origin
  - `contact_buyer` - Send communication to customer
- [ ] Auto-email customers for NDR with resolution options

#### 4.2 Returns & Exchanges
- [ ] Customer self-service return request form
- [ ] Validate order eligibility (time window, product type)
- [ ] Create return via `create_return` or `create_exchange`
- [ ] Admin approval workflow before processing
- [ ] Track return status via `list_returns`

#### 4.3 Manifest & Invoice
- [ ] Daily manifest generation via `generate_manifest`
- [ ] Auto-print manifest for pickup courier
- [ ] Invoice generation via `generate_invoice`
- [ ] Bulk operations for daily order batches

**Deliverable:** Complete exception handling and reverse logistics

---

### Phase 5: Optimization (Week 9-10)
**Goal:** Analytics, reporting, and advanced features

#### 5.1 Analytics Dashboard
- [ ] Shipping cost analysis by courier
- [ ] Delivery performance metrics (on-time %)
- [ ] NDR rate tracking and trend analysis
- [ ] Return reason categorization

#### 5.2 Advanced Features
- [ ] Bulk order creation from CSV upload
- [ ] Courier preference rules (always use X for Y pincode)
- [ ] Automated RTO processing for undelivered orders
- [ ] Inventory sync with Shiprocket (if applicable)

**Deliverable:** Data-driven shipping optimization

---

## 4. Developer Role Assignments

### 4.1 Backend Developer (WordPress/WooCommerce)
**Primary:** WooCommerce integration, webhook handlers, database schema

**Tasks:**
- Create WordPress plugin structure
- Implement WooCommerce hooks (`woocommerce_order_status_processing`, `woocommerce_order_status_completed`)
- Build custom database tables for Shiprocket sync tracking
- Develop REST API endpoints for frontend tracking
- Handle MCP server authentication and request signing

**Key Files to Create:**
```
wp-content/plugins/aargo-shiprocket/
├── aargo-shiprocket.php          # Main plugin file
├── includes/
│   ├── class-mcp-client.php      # MCP HTTP client wrapper
│   ├── class-order-sync.php      # Order synchronization logic
│   ├── class-shipping.php         # Shipping automation
│   ├── class-tracking.php         # Tracking management
│   ├── class-ndr.php             # NDR handling
│   ├── class-returns.php         # Returns & exchanges
│   └── class-webhook-handler.php # Shiprocket webhooks
├── admin/
│   ├── settings-page.php          # Configuration UI
│   └── order-meta-box.php        # Admin order page widget
├── public/
│   └── tracking-page.php         # Customer tracking UI
└── assets/
    ├── css/                       # Admin styles
    └── js/                        # Admin scripts
```

**Skills Required:** PHP, WordPress Plugin API, WooCommerce hooks, REST API

---

### 4.2 DevOps Engineer
**Primary:** MCP server deployment, security, monitoring

**Tasks:**
- Deploy Node.js MCP server on production VPS/cloud
- Configure reverse proxy (Nginx) with SSL
- Set up environment variable management (secure vault)
- Implement health checks and monitoring
- Configure automated deployment (CI/CD)
- Set up log aggregation (Pino logs)
- Configure firewall rules (only WooCommerce server can access MCP)

**Infrastructure:**
```
Server Requirements:
- Node.js 20+ (but < 23)
- 512MB RAM minimum (1GB recommended)
- 10GB storage
- Ubuntu 22.04 LTS

Services:
- PM2 for process management
- Nginx reverse proxy
- Let's Encrypt SSL
- Fail2ban for security
- UFW firewall
```

**Security Checklist:**
- [ ] MCP_AUTH_TOKEN uses 32+ character random string
- [ ] IP whitelist: Only WooCommerce server IP can access MCP
- [ ] SSL/TLS enforced (no HTTP fallback)
- [ ] Rate limiting on `/mcp` endpoint
- [ ] Log rotation and retention policy
- [ ] Regular security updates (automated)

**Skills Required:** Linux, Node.js, Nginx, SSL, PM2, Security hardening

---

### 4.3 Frontend Developer
**Primary:** Customer tracking UI, admin dashboard enhancements

**Tasks:**
- Build responsive order tracking page
- Create admin dashboard widgets for shipping metrics
- Implement real-time status updates (polling or SSE)
- Design mobile-friendly label print interface
- Build return request form with validation

**Tech Stack:**
- HTML5 + CSS3 (Tailwind/Bootstrap)
- Vanilla JavaScript (no heavy frameworks needed)
- WooCommerce template overrides
- WordPress shortcodes for embedding

**Key Pages:**
1. **Order Tracking Page**
   - Input: Order ID + Email
   - Display: Timeline, current status, courier, AWB
   - Actions: Track on courier website (external link)

2. **Admin Dashboard Widget**
   - Today's shipments
   - Pending pickups
   - Recent NDRs
   - Quick action buttons

3. **Return Request Form**
   - Order lookup
   - Reason selection
   - Product condition
   - Bank details for refund

**Skills Required:** HTML, CSS, JavaScript, WordPress theming, Responsive design

---

### 4.4 QA Engineer
**Primary:** Testing, validation, documentation

**Tasks:**
- Create test cases for each phase
- Set up staging environment mirroring production
- Test with real Shiprocket sandbox (if available)
- Validate data integrity (order mapping accuracy)
- Performance testing (webhook load, MCP concurrency)
- Security testing (auth, injection, XSS)
- Write user acceptance test scripts

**Test Scenarios:**
1. **Order Flow:**
   - Place test order → Verify Shiprocket creation → Check AWB generation
   - Test with COD and prepaid orders
   - Test with multiple products
   - Test with invalid addresses

2. **Tracking:**
   - Verify status updates propagate correctly
   - Test edge cases: RTO, NDR, delivered
   - Test customer notification emails

3. **Returns:**
   - Test return request flow
   - Verify Shiprocket return creation
   - Test refund processing

4. **Error Handling:**
   - MCP server down → Graceful degradation
   - Invalid credentials → Clear error messages
   - Shiprocket API errors → Retry logic

**Skills Required:** Testing methodologies, API testing, WordPress testing, Documentation

---

## 5. Technical Specifications

### 5.1 MCP Server Configuration

```bash
# .env file for MCP server
SELLER_EMAIL=your-shiprocket-email@example.com
SELLER_PASSWORD=your-shiprocket-password
PORT=3000
MCP_AUTH_TOKEN=your-32-char-random-token
NODE_ENV=production
```

### 5.2 WooCommerce → Shiprocket Data Mapping

**Order Mapping:**
```php
// WooCommerce Order → Shiprocket Order
$shiprocket_order = [
    'order_id' => $wc_order->get_order_number(),  // Source Order ID
    'order_date' => $wc_order->get_date_created()->format('Y-m-d H:i:s'),
    'pickup_location' => 'default',  // From list_pickup_addresses
    'billing_customer_name' => $wc_order->get_billing_first_name() . ' ' . $wc_order->get_billing_last_name(),
    'billing_last_name' => $wc_order->get_billing_last_name(),
    'billing_address' => $wc_order->get_billing_address_1(),
    'billing_address_2' => $wc_order->get_billing_address_2(),
    'billing_city' => $wc_order->get_billing_city(),
    'billing_pincode' => $wc_order->get_billing_postcode(),
    'billing_state' => $wc_order->get_billing_state(),
    'billing_country' => $wc_order->get_billing_country(),
    'billing_email' => $wc_order->get_billing_email(),
    'billing_phone' => $wc_order->get_billing_phone(),
    'shipping_is_billing' => true,  // Simplified
    'order_items' => [],
    'payment_method' => $wc_order->get_payment_method() === 'cod' ? 'COD' : 'Prepaid',
    'shipping_charges' => $wc_order->get_shipping_total(),
    'giftwrap_charges' => 0,
    'transaction_charges' => 0,
    'total_discount' => $wc_order->get_discount_total(),
    'sub_total' => $wc_order->get_subtotal(),
    'length' => 10,  // Default, customize per product
    'breadth' => 10,
    'height' => 10,
    'weight' => 0.5,  // Default, customize per product
];

// Product items
foreach ($wc_order->get_items() as $item) {
    $product = $item->get_product();
    $shiprocket_order['order_items'][] = [
        'name' => $product->get_name(),
        'sku' => $product->get_sku(),
        'units' => $item->get_quantity(),
        'selling_price' => $item->get_subtotal() / $item->get_quantity(),
        'discount' => $item->get_subtotal() - $item->get_total(),
    ];
}
```

### 5.3 Webhook Endpoints

**WooCommerce → Your Plugin:**
```
POST /wp-json/aargo-shiprocket/v1/webhook/order
Body: { order_id, status, ... }
```

**Shiprocket → Your Plugin (if using webhooks):**
```
POST /wp-json/aargo-shiprocket/v1/webhook/shiprocket
Body: { awb, status, location, ... }
```

### 5.4 Database Schema

```sql
-- Custom table for Shiprocket sync tracking
CREATE TABLE wp_aargo_shiprocket_sync (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wc_order_id BIGINT UNSIGNED NOT NULL,
    shiprocket_order_id VARCHAR(100),
    awb_number VARCHAR(100),
    courier_name VARCHAR(100),
    status VARCHAR(50),
    label_url VARCHAR(500),
    manifest_url VARCHAR(500),
    pickup_date DATE,
    delivered_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wc_order (wc_order_id),
    INDEX idx_awb (awb_number),
    INDEX idx_status (status)
);

-- Table for NDR tracking
CREATE TABLE wp_aargo_shiprocket_ndr (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wc_order_id BIGINT UNSIGNED NOT NULL,
    awb_number VARCHAR(100),
    ndr_code VARCHAR(50),
    ndr_reason TEXT,
    action_taken VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wc_order (wc_order_id),
    INDEX idx_awb (awb_number)
);

-- Table for return requests
CREATE TABLE wp_aargo_shiprocket_returns (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wc_order_id BIGINT UNSIGNED NOT NULL,
    shiprocket_return_id VARCHAR(100),
    return_type ENUM('return', 'exchange'),
    status VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wc_order (wc_order_id)
);
```

---

## 6. Testing Strategy

### 6.1 Unit Testing (MCP Server)
Already covered by existing test suite:
- `test/e2e.test.ts` - Full HTTP transport + MCP client flow
- `test/api-client.test.ts` - Shiprocket API authentication
- `test/tool-integration.test.ts` - All 24 tools registered

**Run tests:** `npm test`

### 6.2 Integration Testing (WooCommerce)
**Staging Environment Required:**
- Clone production WooCommerce to staging
- Use Shiprocket sandbox/test credentials
- Test with real product catalog

**Test Cases:**
1. Order creation with valid address → Shiprocket order created
2. Order creation with invalid pincode → Error handling
3. COD order → COD payment method passed correctly
4. Multiple products → All items in Shiprocket order
5. Weight calculation → Accurate shipping rates

### 6.3 E2E Testing
**Customer Journey:**
1. Place order on website
2. Verify order appears in Shiprocket dashboard
3. Check AWB generation
4. Verify tracking page works
5. Test return request flow

**Operations Journey:**
1. Admin approves order
2. Auto-ship triggers
3. Label generated
4. Pickup scheduled
5. Track until delivery

### 6.4 Load Testing
- 10 concurrent orders → MCP server handles gracefully
- 100 webhook requests → No data loss
- MCP session limit → 100 max sessions (server handles)

---

## 7. Deployment Guide

### 7.1 MCP Server Deployment

```bash
# 1. Clone repository
git clone https://github.com/bfrs/shiprocket-mcp.git
cd shiprocket-mcp

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Create environment file
cat > .env << EOF
SELLER_EMAIL=your-email@aargolifestyle.com
SELLER_PASSWORD=your-password
PORT=3000
MCP_AUTH_TOKEN=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# 5. Start with PM2
npm install -g pm2
pm2 start dist/main.js --name "shiprocket-mcp"
pm2 save
pm2 startup

# 6. Configure Nginx
sudo tee /etc/nginx/sites-available/shiprocket-mcp << 'EOF'
server {
    listen 443 ssl;
    server_name mcp.aargolifestyle.com;
    
    ssl_certificate /etc/letsencrypt/live/mcp.aargolifestyle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.aargolifestyle.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Only allow WooCommerce server IP
        allow 1.2.3.4;  # Replace with actual IP
        deny all;
    }
}
EOF

# 7. Enable site
sudo ln -s /etc/nginx/sites-available/shiprocket-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 8. SSL certificate
sudo certbot --nginx -d mcp.aargolifestyle.com
```

### 7.2 WordPress Plugin Installation

```bash
# 1. Upload plugin to WordPress
scp -r aargo-shiprocket/ user@aargolifestyle.com:/var/www/html/wp-content/plugins/

# 2. Activate in WordPress Admin
# Go to Plugins → Installed Plugins → Activate "Aargo Shiprocket Integration"

# 3. Configure settings
# Go to Settings → Shiprocket Integration
# - MCP Server URL: https://mcp.aargolifestyle.com
# - Auth Token: <from .env>
# - Default pickup address: <from list>
# - Auto-ship: Enable/Disable
```

---

## 8. Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Shiprocket API downtime** | High | Medium | Implement retry logic with exponential backoff; queue failed operations |
| **MCP server crashes** | High | Low | PM2 auto-restart; health checks; monitoring alerts |
| **Data sync errors** | High | Medium | Validation at every step; audit logs; manual reconciliation UI |
| **Security breach** | High | Low | IP whitelisting; strong auth tokens; regular security updates |
| **Rate limiting** | Medium | Medium | Implement request throttling; cache responses where possible |
| **Address validation** | Medium | High | Pre-validate addresses before Shiprocket API call; suggest corrections |
| **Product weight errors** | Medium | High | Require weight/dimensions in product settings; validation before shipping |

---

## 9. Monitoring & Alerts

### 9.1 MCP Server Metrics
- Request count per tool
- Average response time
- Error rate
- Active sessions
- Token refresh frequency

### 9.2 Business Metrics
- Orders synced per day
- Shipping success rate
- Average delivery time
- NDR rate
- Return rate
- Cost per shipment

### 9.3 Alerts
- MCP server down → Slack/email
- High error rate (>5%) → Slack/email
- Shiprocket auth failure → Immediate
- Webhook failures → Queue alert

---

## 10. Next Steps

### Immediate (This Week)
1. [ ] **Backend Dev:** Set up local WordPress development environment
2. [ ] **DevOps:** Provision staging server (VPS)
3. [ ] **QA:** Create test account on Shiprocket (sandbox)
4. [ ] **All:** Review this document and ask questions

### Week 1-2: Phase 1
1. [ ] Deploy MCP server on staging
2. [ ] Create WordPress plugin scaffold
3. [ ] Implement basic order sync
4. [ ] Test with sample orders

### Week 3-4: Phase 2
1. [ ] Implement shipping automation
2. [ ] Add label generation
3. [ ] Test courier selection logic
4. [ ] Validate with real products

### Week 5-6: Phase 3
1. [ ] Build customer tracking page
2. [ ] Add admin dashboard widgets
3. [ ] Implement notification emails
4. [ ] UX testing with team

### Week 7-8: Phase 4
1. [ ] NDR handling
2. [ ] Returns workflow
3. [ ] Manifest generation
4. [ ] End-to-end testing

### Week 9-10: Phase 5
1. [ ] Analytics dashboard
2. [ ] Performance optimization
3. [ ] Production deployment
4. [ ] Team training

---

## 11. Support & Resources

### 11.1 MCP Server Documentation
- Source: `/home/patch/Desktop/shiprocket-mcp`
- README: `README.md`
- Tests: `test/` directory
- Tools: `src/mcp/tools/`

### 11.2 Shiprocket API Documentation
- API Reference: https://apidocs.shiprocket.in/
- Authentication: Email + Password (token-based)
- Rate Limits: Check documentation

### 11.3 WooCommerce Resources
- WooCommerce REST API: https://woocommerce.github.io/woocommerce-rest-api-docs/
- WooCommerce Hooks: https://woocommerce.github.io/code-reference/hooks/hooks.html
- Plugin Development: https://developer.wordpress.org/plugins/

### 11.4 Contact Points
- **Project Lead:** [Your Name]
- **Backend Dev:** [Backend Developer]
- **DevOps:** [DevOps Engineer]
- **Frontend Dev:** [Frontend Developer]
- **QA:** [QA Engineer]

---

## Appendix A: Quick Reference

### MCP Server Endpoints
```
GET  /health                    → Health check
POST /mcp                      → MCP initialization & messages
GET  /mcp                      → SSE stream (requires session ID)
DELETE /mcp                   → Session termination
```

### Shiprocket Tools (All 24)
```
Serviceability:
  estimated_delivery
  shipping_rate_calculator

Orders:
  order_list
  order_create
  get_order_detail

Shipping:
  order_ship
  order_schedule_pickup
  order_track

Settings:
  list_pickup_addresses

NDR:
  list_ndr
  get_ndr
  reattempt_ndr
  mark_rto
  contact_buyer

Returns:
  list_returns
  create_return
  create_exchange
  update_return
  cancel_return

Manifest:
  generate_manifest
  print_manifest

Invoice:
  generate_invoice
```

### WooCommerce Order Status Flow
```
pending → processing → shipped → out_for_delivery → delivered
   ↓         ↓            ↓            ↓                ↓
Create   Sync to     Generate     Track           Complete
Order    Shiprocket  AWB + Label  Status          Order
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-14  
**Next Review:** After Phase 1 completion
