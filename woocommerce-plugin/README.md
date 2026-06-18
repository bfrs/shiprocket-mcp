# Aargo Shiprocket WooCommerce Plugin

## Overview
WordPress plugin that integrates WooCommerce with the Shiprocket MCP Server for automated shipping, tracking, NDR handling, courier selection, bulk operations, analytics, and returns. Ships in three tiers — choose Option A for core integration, Option B for smart automation, or Option C (Full Automation) for the complete package.

## File Structure
```
aargo-shiprocket/
├── aargo-shiprocket.php              # Main plugin file (bootstraps all classes)
├── includes/
│   ├── class-mcp-client.php          # HTTP client for the MCP server
│   ├── class-order-sync.php          # WooCommerce → Shiprocket sync
│   ├── class-tracking.php            # Customer tracking endpoint + page
│   ├── class-webhook.php             # Shiprocket → WooCommerce updates
│   ├── class-db.php                  # Database schema
│   ├── class-admin.php               # Admin settings page
│   ├── class-smart-courier.php       # AI-style courier scoring (Option B)
│   ├── class-ndr-automation.php      # NDR handling (Option B)
│   ├── class-bulk-operations.php     # Bulk sync / ship / label actions (Option C)
│   ├── class-analytics.php           # Shipping analytics dashboard (Option C)
│   └── class-returns.php             # Automated returns + exchanges (Option C)
├── admin/
│   └── settings.php                  # Admin settings page
├── public/
│   ├── tracking-page.php             # Customer tracking UI  ([aargo_tracking])
│   └── return-request.php            # Customer return / exchange form ([aargo_return_request])
├── assets/
│   ├── css/
│   │   ├── admin.css                 # Admin styles
│   │   └── tracking.css              # Tracking + return page styles
│   └── js/
│       ├── admin.js                  # Admin scripts
│       ├── tracking.js               # Tracking page scripts
│       └── return-request.js         # Return request page scripts
```

## Installation
1. Upload to `wp-content/plugins/aargo-shiprocket/`
2. Activate in **WordPress Admin → Plugins**
3. Open **Shiprocket** in the admin sidebar
4. Configure MCP Server URL and Auth Token
5. Set your pickup postcode and default parcel dimensions
6. Enable auto-sync and auto-ship as needed

## Feature Tiers

### Option A — Core Integration
The baseline tier. Every installation includes:
- **Auto-Sync** of new WooCommerce orders to Shiprocket
- **Auto-Ship** with cheapest-courier selection
- **Customer Tracking** via the `[aargo_tracking]` shortcode
- **Webhook Updates** for status changes and customer notifications
- **Admin Dashboard** with order meta box, quick sync, settings, and webhook URL
- Database tables: `*_aargo_shiprocket_sync`, `*_aargo_shiprocket_ndr`, `*_aargo_shiprocket_returns`, `*_aargo_shiprocket_webhooks`

### Option B — Smart Automation
Adds intelligence and proactive handling on top of Option A:
- **Smart Courier Selection** — multi-factor scoring (price 30%, speed 25%, reliability 25%, COD 10%, RTO 10%) with courier history tracking
- **NDR Automation** — daily cron checks pending non-delivery reports, attempts auto-remediation, and notifies customers
- Courier performance history stored in `aargo_sr_courier_history` option

### Option C — Full Automation
Adds scale, insight, and lifecycle coverage. **This release ships Option C.**
- **Bulk Operations** — sync, ship, generate labels, generate manifests for many orders at once from the orders list
- **Analytics Dashboard** — KPI cards, courier performance, NDR stats, revenue-at-risk, shipping cost trends
- **Returns & Exchanges** — customer-facing request form (`[aargo_return_request]`), eligibility check (delivery status + return window), Shiprocket return creation, database logging, customer + admin email notifications

## Database Tables
Created on activation via `Aargo_Shiprocket_DB::create_tables()`:

| Table | Purpose |
|-------|---------|
| `{prefix}_aargo_shiprocket_sync` | Per-order sync tracking (AWB, courier, status, label URL) |
| `{prefix}_aargo_shiprocket_ndr` | NDR records and resolutions |
| `{prefix}_aargo_shiprocket_returns` | Return / exchange requests |
| `{prefix}_aargo_shiprocket_webhooks` | Webhook payload log |

## Shortcodes

| Shortcode | Purpose |
|-----------|---------|
| `[aargo_tracking]` | Customer tracking form + results |
| `[aargo_return_request]` | Customer return / exchange form |

## REST API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/wp-json/aargo/v1/shiprocket-webhook` | POST | Shiprocket → WooCommerce updates |
| `/wp-json/aargo/v1/track-order` | POST | Public order tracking lookup |

## Security
- Auth token required for MCP requests
- Nonce validation on all AJAX endpoints (`aargo_sr_nonce`, `aargo_return_nonce`)
- REST API permission checks
- Input sanitization on all user input
- Prepared SQL statements throughout

## Requirements
- WordPress 5.8+
- PHP 7.4+
- WooCommerce 6.0+
- Shiprocket MCP Server running and reachable

## Configuration

### MCP Server URL
Point to your Shiprocket MCP server:
- Local: `http://localhost:3000`
- Production: `https://mcp.yourdomain.com`

### Webhook URL
Set this in your Shiprocket dashboard:
```
https://yourdomain.com/wp-json/aargo/v1/shiprocket-webhook
```

### Return Window
Default is 7 days. Adjust in **Shiprocket → Settings**, or via filter:
```php
update_option('aargo_sr_return_window', 10);
```

## Analytics Submenu
The Analytics dashboard is added under the **Shiprocket** admin menu. It surfaces:
- Total / Delivered / In-Transit / NDR order counts
- Delivery success rate
- Courier performance (delivery rate, RTO rate, NDR rate)
- NDR stats and resolutions
- Revenue at risk from RTOs and NDRs

## Bulk Actions
On the WooCommerce orders list, the **Bulk Actions** dropdown exposes:
- **Sync to Shiprocket** — push selected orders to Shiprocket
- **Ship orders** — assign couriers and generate AWBs
- **Generate labels** — bulk-download shipping labels
- **Generate manifest** — print daily pickup manifest

## Support
For issues or questions, contact your Aargo Lifestyle development team.
