# Shiprocket MCP Integration — Production Readiness Plan

**Project:** Aargo Lifestyle × Shiprocket MCP  
**Version:** 1.1.0 (Plugin) / 1.0.0 (MCP Server)  
**Date:** 2026-06-15  
**Status:** Plan — Ready for Execution  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [MCP Server — Current Status & Gaps](#2-mcp-server--current-status--gaps)
3. [WooCommerce Plugin — Current Status & Gaps](#3-woocommerce-plugin--current-status--gaps)
4. [Integration Points](#4-integration-points)
5. [Security Audit](#5-security-audit)
6. [Production Readiness Checklist](#6-production-readiness-checklist)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Plan](#8-deployment-plan)
9. [Prioritized Action Items](#9-prioritized-action-items)
10. [Dependencies & Sequencing](#10-dependencies--sequencing)

---

## 1. Executive Summary

This plan covers two components:

| Component | Tech Stack | Status | Files |
|-----------|-----------|--------|-------|
| **MCP Server** | TypeScript, Express, MCP SDK, Pino | Feature-complete, tests passing | 14 source files, 10 test files |
| **WooCommerce Plugin** | PHP, WordPress API, WooCommerce | Feature-complete (Option A/B/C) | 1 main + 11 classes + 3 JS + 2 CSS + 2 templates |

**Overall Assessment:** Both components are feature-complete. The gaps are in production hardening — error resilience, security edge cases, monitoring, and documentation for a non-technical operator. No missing features block deployment; the items below are reliability and safety improvements.

---

## 2. MCP Server — Current Status & Gaps

### 2.1 What Exists (✅ Complete)

| Area | Details | Status |
|------|---------|--------|
| **Tools** | 24 tools across 7 modules: serviceability (2), orders (4), shipping (4), NDR (5), returns (5), manifest/invoice (3), settings (1) | ✅ |
| **Transports** | STDIO + HTTP (Streamable HTTP with SSE) | ✅ |
| **Auth** | Email/password → Shiprocket token, auto-refresh on 401 with cooldown | ✅ |
| **Session Management** | Per-session client isolation, TTL-based pruning (30min), max 100 sessions | ✅ |
| **Error Handling** | `withToolErrorHandling` wrapper on all tools, AxiosError differentiation | ✅ |
| **Logging** | Pino logger with pretty-print (dev) / JSON (prod), stderr output | ✅ |
| **Health Check** | `GET /health` endpoint returning `{ status: "ok" }` | ✅ |
| **Input Validation** | Zod schemas on all tool parameters (email, phone, pincode regex) | ✅ |
| **HTTP Auth** | Bearer token with `timingSafeEqual` comparison | ✅ |
| **Graceful Shutdown** | SIGINT/SIGTERM handlers, connection cleanup | ✅ |
| **Docker** | Multi-stage Dockerfile, non-root user, health check | ✅ |
| **systemd** | Service file with security hardening | ✅ |
| **Tests** | 13 tests across 8 files: API client, token refresh, env validation, HTTP transport, server startup, tool integration, regression, E2E | ✅ |
| **MSW Mocking** | Full Shiprocket API mock coverage for all 24 tools | ✅ |
| **Coverage Config** | 80% lines/functions/statements, 70% branches threshold | ✅ |

### 2.2 Gaps & Improvements

| ID | Item | Priority | Effort | Details |
|----|------|----------|--------|---------|
| **M1** | Rate limiting on HTTP endpoint | P1 | Medium | No rate limiting on `/mcp` POST. A malicious client could exhaust sessions or hammer Shiprocket API. Add express-rate-limit or token-bucket per IP/session. |
| **M2** | Retry logic for Shiprocket API (non-401) | P1 | Small | Current client only retries on 401. Add exponential backoff for 429, 500, 502, 503, 504 errors. Shiprocket API is known to be flaky. |
| **M3** | Request/response logging middleware | P2 | Small | No HTTP request logging beyond errors. Add request ID, duration, status code logging for debugging production issues. |
| **M4** | MCP_AUTH_TOKEN enforcement in STDIO mode | P2 | Small | STDIO mode has no auth — acceptable for local Claude Desktop, but should be documented as a security boundary. |
| **M5** | Connection pool / keepalive for Shiprocket API | P2 | Small | Each `ShiprocketClient` creates a new axios instance. For multi-session HTTP mode, consider connection pooling. |
| **M6** | Structured error codes in tool responses | P2 | Small | Tools return generic fallback messages. Add machine-readable error codes (e.g., `AUTH_FAILED`, `RATE_LIMITED`, `ORDER_NOT_FOUND`) alongside human messages. |
| **M7** | Prometheus/metrics endpoint | P2 | Medium | No metrics exposure. Add `/metrics` with request counts, latency histograms, active sessions, auth failures for monitoring. |
| **M8** | CORS headers for HTTP transport | P1 | Small | No CORS configuration. If the WooCommerce plugin calls the MCP server cross-origin, CORS must be configured. Currently the plugin uses server-side `wp_remote_post` so this is not blocking, but needed for any browser-based client. |
| **M9** | Token expiry proactive refresh | P2 | Small | Token is only refreshed reactively (on 401). Shiprocket tokens expire — add proactive refresh before expiry (e.g., every 12 hours). |
| **M10** | `.env` file loading | P2 | Small | No `dotenv` package. Environment variables must be set externally. Add optional `.env` loading for easier deployment. |
| **M11** | `list_pickup_addresses` tool parameter mismatch | P1 | Small | The MCP tool `order_create` expects `pickup_location` (string nickname), but the plugin's `build_order_payload` passes `order_id` as a top-level field that the MCP tool doesn't accept. The MCP tool generates its own `order_id` with `MCP-${randomUUID()}`. The plugin sends `order_id` in the payload which gets ignored. Not a bug, but wasteful. |
| **M12** | `shipping_rate_calculator` parameter name mismatch | P1 | Small | The MCP tool expects `cod_or_prepaid` (enum: 'COD'/'PREPAID'), but the plugin's `get_rates()` sends `cod` (boolean). This will cause the tool to receive incorrect parameter types. |
| **M13** | `order_track` parameter mismatch | P1 | Small | The MCP tool expects `awb_number` (string), but the plugin's `track_order()` sends `awb` and `order_id`. The parameter name mismatch means tracking calls may fail. |
| **M14** | `order_ship` parameter mismatch | P1 | Small | The MCP tool expects `order_id` (string) and optional `courier_id` (number), but the plugin's `ship_order()` sends `order_id` and `courier_name` (string). The MCP tool doesn't accept `courier_name`. |
| **M15** | Missing `order_pickup_schedule` tool name | P2 | Small | The plugin calls `order_pickup_schedule` but the MCP tool is named `order_schedule_pickup`. This will cause a "tool not found" error. |

---

## 3. WooCommerce Plugin — Current Status & Gaps

### 3.1 What Exists (✅ Complete)

| Area | Files | Status |
|------|-------|--------|
| **Main Plugin File** | `aargo-shiprocket.php` (224 lines) | ✅ |
| **MCP Client** | `class-mcp-client.php` (270 lines) — JSON-RPC 2.0 client, session init, health check, tool wrappers | ✅ |
| **Order Sync** | `class-order-sync.php` (277 lines) — Auto-sync on `processing`, manual AJAX sync, auto-ship, payload builder | ✅ |
| **Tracking** | `class-tracking.php` (196 lines) — REST endpoint, order lookup, timeline formatting, courier URL mapping | ✅ |
| **Webhook** | `class-webhook.php` (285 lines) — 6 event handlers (shipped, out_for_delivery, delivered, undelivered, RTO, NDR), customer emails | ✅ |
| **Database** | `class-db.php` (132 lines) — 4 tables via `dbDelta`, CRUD helpers | ✅ |
| **Admin** | `class-admin.php` (224 lines) — Settings page, connection test, tracking page creation | ✅ |
| **Smart Courier** | `class-smart-courier.php` (279 lines) — Multi-factor scoring (price 30%, speed 25%, reliability 25%, COD 10%, RTO 10%) | ✅ |
| **NDR Automation** | `class-ndr-automation.php` (333 lines) — Reason-based auto-action, daily cron, escalation emails | ✅ |
| **Bulk Operations** | `class-bulk-operations.php` (285 lines) — 4 bulk actions, HPOS compatible, admin notices | ✅ |
| **Analytics** | `class-analytics.php` (239 lines) — KPI cards, courier report, NDR trends, recent activity | ✅ |
| **Returns** | `class-returns.php` (226 lines) — Eligibility check, return/exchange form, email notifications | ✅ |
| **Admin JS** | `admin.js` (94 lines) — Sync, test connection, create tracking page | ✅ |
| **Tracking JS** | `tracking.js` (108 lines) — Form submission, timeline rendering | ✅ |
| **Return JS** | `return-request.js` (62 lines) — Return form submission | ✅ |
| **Admin CSS** | `admin.css` (53 lines) | ✅ |
| **Tracking CSS** | `tracking.css` (254 lines) — Responsive, timeline styles | ✅ |
| **Tracking Template** | `tracking-page.php` (66 lines) | ✅ |
| **Return Template** | `return-request.php` (88 lines) | ✅ |

### 3.2 Gaps & Improvements

| ID | Item | Priority | Effort | Details |
|----|------|----------|--------|---------|
| **P1** | **Missing `admin/settings.php`** | P0 | Small | The VERIFICATION.md flags this: `admin/settings.php` is referenced by `aargo_shiprocket_admin_page()` but the file doesn't exist. The `admin/` directory is empty. However, `class-admin.php` has its own `settings_page()` method that renders inline HTML, so the admin page works via the class — the separate file is dead code. **Action:** Either create the file or remove the reference. |
| **P2** | **MCP Client parameter mismatches** | P0 | Medium | The MCP client's wrapper methods send parameters that don't match the MCP server's Zod schemas. See M11–M15 above. These will cause runtime failures. **Critical fixes needed:** `track_order` (awb → awb_number), `ship_order` (courier_name → courier_id), `get_rates` (cod boolean → cod_or_prepaid enum), `schedule_pickup` (tool name mismatch). |
| **P3** | **MCP Client session management** | P1 | Medium | The MCP client creates a new session for every `call_tool()` invocation. It doesn't reuse the `session_id` from `initialize_session()`. The `call_tool()` method doesn't send `mcp-session-id` header. This means every tool call creates a new session on the MCP server, wasting resources. |
| **P4** | **Webhook security — no signature verification** | P0 | Small | The webhook endpoint (`/shiprocket-webhook`) has `permission_callback => '__return_true'` and no signature/secret verification. Anyone can POST to this endpoint. **Fix:** Add a shared secret query parameter or header that Shiprocket sends, and validate it. |
| **P5** | **Duplicate REST route registration** | P1 | Small | Routes are registered twice: once in `aargo_shiprocket_register_routes()` (main file, line 96) and again in `class-webhook.php::register_routes()`. This causes WordPress to log duplicate route warnings. |
| **P6** | **Missing uninstall hook** | P1 | Small | No `uninstall.php` or `register_uninstall_hook`. When the plugin is deleted, the 4 custom tables and all options remain in the database. |
| **P7** | **`class-tracking.php` enqueues assets globally** | P2 | Small | `enqueue_scripts()` in `class-tracking.php` loads tracking CSS/JS on every page. The main file's `aargo_shiprocket_public_assets()` correctly limits to shortcode pages. The class method is redundant and should be removed or gated. |
| **P8** | **Analytics SQL queries not using `$wpdb->prepare()`** | P1 | Small | `class-analytics.php` uses raw SQL in `get_dashboard_stats()` and `get_recent_activity()` without `$wpdb->prepare()`. While these queries don't include user input, it violates WordPress coding standards and could be flagged by security scanners. |
| **P9** | **NDR automation SQL not using `$wpdb->prepare()`** | P1 | Small | `check_pending_ndrs()` in `class-ndr-automation.php` uses raw SQL without `$wpdb->prepare()`. Same concern as P8. |
| **P10** | **`create_return` is a simulated fallback** | P1 | Small | `class-mcp-client.php::create_return()` returns a fake return_id using `md5()`. The MCP server actually has `create_return` tool. The client should call it instead of faking. Same for `reattempt_ndr()` and `generate_manifest()`. |
| **P11** | **No error logging to file** | P1 | Small | Plugin uses `error_log()` nowhere. Failed API calls, webhook errors, and sync failures are only stored in order notes and DB. Add `error_log()` or a custom log file for debugging. |
| **P12** | **Missing HPOS compatibility declaration** | P1 | Small | WooCommerce 8.0+ requires HPOS compatibility declaration via `before_woocommerce_init` action. Without it, the plugin shows a warning in WooCommerce admin. |
| **P13** | **No admin menu icon** | P2 | Small | Uses `dashicons-cart` which is generic. A custom SVG icon would improve UX. |
| **P14** | **Settings page lacks input validation** | P2 | Small | `register_setting()` calls don't include `sanitize_callback`. While WordPress sanitizes on save, explicit callbacks prevent invalid data (e.g., non-URL in MCP URL field). |
| **P15** | **No debug/test mode** | P2 | Small | No way to enable verbose logging or dry-run mode for testing without affecting live orders. |
| **P16** | **Return form missing `reason_category` field mapping** | P2 | Small | The return-request.php template has a `reason_category` select dropdown, but the JS (`return-request.js`) doesn't send `reason_category` in the AJAX payload. The PHP handler reads it but it will always be empty. |
| **P17** | **Webhook `process()` method creates new instance** | P2 | Small | `aargo_shiprocket_handle_webhook()` in the main file creates a new `Aargo_Shiprocket_Webhook()` instance, but the class is already instantiated in `aargo_shiprocket_init()`. This is wasteful and the `process()` method ignores its `$data` parameter, re-reading from the request. |
| **P18** | **No i18n on most strings** | P2 | Medium | Most user-facing strings (emails, admin notices, order notes) are not wrapped in `__()` or `esc_html__()`. The text domain is declared but barely used. |
| **P19** | **`class-analytics.php` references non-existent `shipping_cost` column** | P1 | Small | `get_dashboard_stats()` queries `AVG(shipping_cost)` but the `aargo_shiprocket_sync` table schema in `class-db.php` doesn't have a `shipping_cost` column. This query will return NULL. |
| **P20** | **No nonce on meta box sync button** | P2 | Small | The "Sync to Shiprocket" button in the order meta box uses AJAX with nonce from `aargo_sr_ajax.nonce`, which is correct. However, the meta box callback doesn't output a nonce field — it relies on the admin scripts enqueue, which only loads on specific hooks. If the meta box renders on a different hook, the nonce won't be available. |

---

## 4. Integration Points

### 4.1 MCP Server ↔ Plugin Communication

```
Plugin (PHP)                          MCP Server (TypeScript)
─────────────                         ───────────────────────
class-mcp-client.php                  
  │                                   
  ├─ initialize_session()  ──POST──►  /mcp (initialize)
  │                                    └─ returns mcp-session-id header
  │                                   
  ├─ call_tool()           ──POST──►  /mcp (tools/call)
  │   └─ JSON-RPC 2.0                 └─ routes to tool handler
  │                                    └─ returns JSON-RPC response
  │                                   
  └─ health_check()        ──GET───►  /health
                                      └─ returns { status: "ok" }
```

**Current Issue:** The plugin's `call_tool()` doesn't send the `mcp-session-id` header from `initialize_session()`. Each call creates a new session. **Fix:** Store session_id and include it in subsequent requests.

### 4.2 Plugin ↔ WooCommerce Hooks

| Hook | Class | Action |
|------|-------|--------|
| `woocommerce_order_status_processing` | Order_Sync | Auto-sync to Shiprocket |
| `woocommerce_checkout_order_created` | Order_Sync | Add `_aargo_source` meta |
| `bulk_actions-edit-shop_order` | Bulk_Operations | Add bulk action options |
| `handle_bulk-actions-edit-shop_order` | Bulk_Operations | Process bulk actions |
| `add_meta_boxes` | Main file | Shiprocket status meta box |
| `admin_menu` | Admin, Analytics | Settings + analytics pages |
| `wp_enqueue_scripts` | Main file, Tracking | Public assets |
| `admin_enqueue_scripts` | Main file, Admin | Admin assets |
| `rest_api_init` | Main file, Webhook | REST route registration |
| `aargo_order_synced` | Order_Sync | Trigger auto-ship |
| `aargo_ndr_created` | Webhook → NDR_Automation | Trigger NDR handling |
| `aargo_daily_ndr_check` | NDR_Automation | Daily cron |

### 4.3 Plugin ↔ Shiprocket API (via MCP)

| Plugin Method | MCP Tool | Shiprocket API |
|---------------|----------|----------------|
| `create_order()` | `order_create` | POST `/v1/external/orders/create/adhoc` |
| `ship_order()` | `order_ship` | POST `/v1/external/courier/assign/awb` |
| `track_order()` | `order_track` | GET `/v1/external/courier/track/awb/:awb` |
| `get_rates()` | `shipping_rate_calculator` | GET `serviceability/courier/ratingserviceability` |
| `generate_label()` | `generate_shipment_label` | POST `/v1/external/courier/generate/label` |
| `list_pickup_addresses()` | `list_pickup_addresses` | GET `/v1/external/settings/company/pickup` |
| `get_orders()` | `order_list` | GET `/v1/external/orders` |
| `schedule_pickup()` | `order_schedule_pickup` | POST `/v1/external/courier/generate/pickup` |
| `create_return()` | **SIMULATED** | Should use `create_return` tool |
| `reattempt_ndr()` | **SIMULATED** | Should use `reattempt_ndr` tool |
| `generate_manifest()` | **SIMULATED** | Should use `generate_manifest` tool |

### 4.4 Webhook Flow (Shiprocket → Plugin → WooCommerce)

```
Shiprocket Dashboard
  │
  ├─ Webhook POST ──► /wp-json/aargo/v1/shiprocket-webhook
  │                    │
  │                    ├─ Log to aargo_shiprocket_webhooks table
  │                    ├─ Find order by AWB number
  │                    ├─ Route to event handler:
  │                    │   ├─ SHIPPED → update status, email customer
  │                    │   ├─ OUT_FOR_DELIVERY → update status, email
  │                    │   ├─ DELIVERED → complete order, update courier history
  │                    │   ├─ UNDELIVERED → log NDR, email customer
  │                    │   ├─ RTO → fail order, update courier history
  │                    │   └─ NDR_CREATED → log NDR, trigger NDR automation
  │                    └─ Return 200
```

---

## 5. Security Audit

### 5.1 MCP Server Security

| Area | Status | Notes |
|------|--------|-------|
| **Auth token validation** | ✅ | `timingSafeEqual` comparison prevents timing attacks |
| **Input validation** | ✅ | Zod schemas with regex validation on all user inputs |
| **SQL injection** | ✅ N/A | No database — pure API proxy |
| **XSS** | ✅ N/A | JSON API — no HTML rendering |
| **Rate limiting** | ❌ | No rate limiting on any endpoint |
| **CORS** | ❌ | Not configured (not blocking for server-to-server) |
| **HTTPS enforcement** | ❌ | No HTTPS redirect — relies on reverse proxy |
| **Secrets in logs** | ✅ | Pino redaction not configured, but credentials are only in env vars, not logged |
| **Dependency security** | ⚠️ | No `npm audit` in CI — should be added |
| **Container security** | ✅ | Non-root user, minimal Alpine image, read-only filesystem |

### 5.2 WooCommerce Plugin Security

| Area | Status | Notes |
|------|--------|-------|
| **ABSPATH guard** | ✅ | All PHP files have `if (!defined('ABSPATH')) exit;` |
| **Nonce validation** | ✅ | `check_ajax_referer()` on all AJAX handlers |
| **Capability checks** | ✅ | `current_user_can('manage_woocommerce')` or `manage_options` |
| **Input sanitization** | ✅ | `sanitize_text_field()`, `sanitize_email()`, `sanitize_textarea_field()` |
| **Output escaping** | ✅ | `esc_html()`, `esc_url()`, `esc_attr()` throughout |
| **Prepared SQL** | ⚠️ | Most queries use `$wpdb->prepare()`, but analytics and NDR cron use raw SQL |
| **Webhook auth** | ❌ | No signature verification on webhook endpoint |
| **REST permission** | ⚠️ | `__return_true` on both REST routes — tracking is public (intentional), webhook is unprotected |
| **Auth token storage** | ⚠️ | MCP token stored in `wp_options` — accessible to any plugin/theme. Acceptable for single-site. |
| **CSRF on return form** | ✅ | Nonce validation via `check_ajax_referer('aargo_return_nonce')` |
| **File upload** | ✅ N/A | No file uploads |
| **Direct file access** | ✅ | ABSPATH guards prevent direct execution |

### 5.3 Critical Security Fixes Required

1. **Webhook signature verification** (P0) — Add shared secret validation
2. **Rate limiting on MCP server** (P1) — Prevent abuse
3. **Fix raw SQL in analytics** (P1) — Use `$wpdb->prepare()` even for static queries

---

## 6. Production Readiness Checklist

### 6.1 Error Handling & Logging

| ID | Item | Component | Priority | Effort |
|----|------|-----------|----------|--------|
| E1 | Add `error_log()` calls for failed MCP calls | Plugin | P1 | Small |
| E2 | Add WordPress debug log integration | Plugin | P2 | Small |
| E3 | Add request duration logging to MCP server | Server | P2 | Small |
| E4 | Add structured error codes to tool responses | Server | P2 | Small |
| E5 | Add webhook retry for failed processing | Plugin | P2 | Medium |
| E6 | Add order note for every MCP API failure | Plugin | P1 | Small |

### 6.2 Performance Optimization

| ID | Item | Component | Priority | Effort |
|----|------|-----------|----------|--------|
| F1 | Cache pickup address lookup (reused on every order sync) | Plugin | P1 | Small |
| F2 | Batch MCP calls for bulk operations | Plugin | P2 | Medium |
| F3 | Add connection pooling for HTTP transport | Server | P2 | Small |
| F4 | Optimize analytics queries with indexes | Plugin | P2 | Small |
| F5 | Add transient caching for courier history | Plugin | P2 | Small |

### 6.3 Monitoring & Alerts

| ID | Item | Component | Priority | Effort |
|----|------|-----------|----------|--------|
| O1 | Add `/metrics` endpoint (Prometheus format) | Server | P2 | Medium |
| O2 | Add admin dashboard widget for MCP health | Plugin | P2 | Small |
| O3 | Add email alert for MCP server unreachable | Plugin | P1 | Small |
| O4 | Add webhook delivery monitoring | Plugin | P2 | Small |

### 6.4 Backup & Rollback

| ID | Item | Component | Priority | Effort |
|----|------|-----------|----------|--------|
| B1 | Document database backup procedure | Both | P2 | Small |
| B2 | Add `uninstall.php` for clean removal | Plugin | P1 | Small |
| B3 | Document rollback procedure for plugin updates | Plugin | P2 | Small |
| B4 | Add plugin version check on activation | Plugin | P2 | Small |

---

## 7. Testing Strategy

### 7.1 MCP Server Tests (Current)

| Test File | Coverage | Status |
|-----------|----------|--------|
| `api-client.test.ts` | Auth, request making, token refresh | ✅ |
| `token-refresh.test.ts` | 401 retry logic | ✅ |
| `env-validation.test.ts` | Environment variable validation | ✅ |
| `http-transport.test.ts` | HTTP endpoint, session management | ✅ |
| `server-startup.test.ts` | Server initialization | ✅ |
| `tool-integration.test.ts` | Tool registration and invocation | ✅ |
| `regression.test.ts` | Edge cases and regression tests | ✅ |
| `e2e.test.ts` | Full E2E with MCP client SDK | ✅ |

### 7.2 MCP Server Tests (Needed)

| ID | Test | Priority | Effort |
|----|------|----------|--------|
| T1 | Rate limiting behavior | P1 | Small |
| T2 | Concurrent session handling (100 max) | P2 | Small |
| T3 | Stale connection pruning | P2 | Small |
| T4 | Shiprocket API timeout handling | P1 | Small |
| T5 | Invalid Zod parameter rejection | P2 | Small |
| T6 | Auth failure propagation to tools | P1 | Small |

### 7.3 WooCommerce Plugin Tests (Needed)

| ID | Test | Priority | Effort |
|----|------|----------|--------|
| T7 | PHP unit tests for each class | P2 | Large |
| T8 | MCP client parameter validation | P0 | Small |
| T9 | Webhook event routing | P1 | Medium |
| T10 | Order sync payload building | P1 | Medium |
| T11 | Return eligibility logic | P1 | Small |
| T12 | Smart courier scoring | P2 | Small |
| T13 | NDR action determination | P2 | Small |
| T14 | Bulk action processing | P2 | Medium |
| T15 | Database table creation/upgrade | P1 | Small |

### 7.4 Integration Tests (Needed)

| ID | Test | Priority | Effort |
|----|------|----------|--------|
| T16 | Plugin → MCP server full flow | P1 | Large |
| T17 | Webhook → WooCommerce order update | P1 | Medium |
| T18 | Bulk sync → ship → label flow | P2 | Large |
| T19 | Return request → Shiprocket return creation | P2 | Medium |

---

## 8. Deployment Plan

### 8.1 MCP Server Deployment

#### Option A: Docker (Recommended)

```bash
# Build image
docker build -t shiprocket-mcp .

# Run with environment
docker run -d \
  --name shiprocket-mcp \
  -p 3000:3000 \
  -e SELLER_EMAIL=your@email.com \
  -e SELLER_PASSWORD=yourpassword \
  -e MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  -e NODE_ENV=production \
  --restart unless-stopped \
  shiprocket-mcp
```

#### Option B: PM2

```bash
npm install -g pm2
npm ci --production
npm run build
pm2 start dist/main.js --name shiprocket-mcp --env production
pm2 save
pm2 startup
```

#### Option C: systemd

```bash
# Copy service file
sudo cp shiprocket-mcp.service /etc/systemd/system/
# Edit WorkingDirectory and environment
sudo systemctl daemon-reload
sudo systemctl enable shiprocket-mcp
sudo systemctl start shiprocket-mcp
```

### 8.2 Plugin Deployment

1. Upload `aargo-shiprocket-plugin-v1.1.0.zip` via WP Admin → Plugins → Add New → Upload
2. Activate plugin
3. Configure:
   - MCP Server URL (e.g., `https://mcp.aargolifestyle.com`)
   - MCP Auth Token (same as server's `MCP_AUTH_TOKEN`)
   - Pickup Postcode
   - Default dimensions
4. Create tracking page (Quick Actions button)
5. Create return request page (add `[aargo_return_request]` shortcode to a page)
6. Set webhook URL in Shiprocket dashboard: `https://aargolifestyle.com/wp-json/aargo/v1/shiprocket-webhook`

### 8.3 Verification Steps

| Step | Command/Action | Expected Result |
|------|---------------|-----------------|
| 1. Health check | `curl http://localhost:3000/health` | `{ "status": "ok" }` |
| 2. MCP auth | `curl -H "Authorization: Bearer TOKEN" -X POST http://localhost:3000/mcp -d '{"jsonrpc":"2.0","method":"initialize",...}'` | Session ID returned |
| 3. Plugin connection | WP Admin → Shiprocket → Test Connection | "Connected to MCP Server" |
| 4. Order sync | Create test WooCommerce order | Shiprocket order created, meta box shows ID |
| 5. Tracking | Visit tracking page, enter order ID | Timeline displayed |
| 6. Webhook | Trigger test webhook from Shiprocket | Order status updated in WooCommerce |
| 7. Return | Submit return request form | Return logged in database |

---

## 9. Prioritized Action Items

### P0 — Must Fix Before Production (Blocking)

| ID | Item | Effort | Dependencies |
|----|------|--------|--------------|
| P2 | Fix MCP client parameter mismatches (M11–M15) | Medium | None |
| P3 | Fix MCP client session reuse | Medium | None |
| P4 | Add webhook signature verification | Small | None |
| P10 | Replace simulated fallback methods with real MCP calls | Small | P2 |
| P16 | Fix return form `reason_category` not sent in AJAX | Small | None |

### P1 — Should Fix Before Production (Important)

| ID | Item | Effort | Dependencies |
|----|------|--------|--------------|
| M1 | Add rate limiting to MCP HTTP endpoint | Medium | None |
| M2 | Add retry logic for Shiprocket API (429, 5xx) | Small | None |
| P5 | Remove duplicate REST route registration | Small | None |
| P6 | Add uninstall hook for clean removal | Small | None |
| P8 | Fix raw SQL in analytics to use `$wpdb->prepare()` | Small | None |
| P9 | Fix raw SQL in NDR cron to use `$wpdb->prepare()` | Small | None |
| P11 | Add error logging to file | Small | None |
| P12 | Add HPOS compatibility declaration | Small | None |
| P19 | Fix `shipping_cost` column reference in analytics | Small | P8 |
| E1 | Add `error_log()` for failed MCP calls | Small | None |
| E6 | Add order note for every MCP API failure | Small | None |
| O3 | Add email alert for MCP server unreachable | Small | None |
| B2 | Add `uninstall.php` | Small | P6 |
| F1 | Cache pickup address lookup | Small | None |

### P2 — Nice to Have (Post-Launch)

| ID | Item | Effort | Dependencies |
|----|------|--------|--------------|
| M3 | Request/response logging middleware | Small | None |
| M6 | Structured error codes | Small | None |
| M7 | Prometheus metrics endpoint | Medium | M3 |
| M8 | CORS configuration | Small | None |
| M9 | Proactive token refresh | Small | None |
| M10 | `.env` file loading | Small | None |
| P7 | Fix global asset enqueue in tracking class | Small | None |
| P13 | Custom admin menu icon | Small | None |
| P14 | Settings input validation callbacks | Small | None |
| P15 | Debug/test mode | Small | None |
| P17 | Fix webhook handler instance reuse | Small | None |
| P18 | i18n for all strings | Medium | None |
| P20 | Ensure nonce availability for meta box | Small | None |
| T1–T19 | All testing items | Large | Various |

---

## 10. Dependencies & Sequencing

```
Phase 1: Critical Fixes (P0) — Estimated 1 day
─────────────────────────────────────────────────
  P2: Fix MCP client parameters ──┐
  P3: Fix MCP client sessions   ──┤──► P10: Replace fallback methods
  P4: Webhook signature          │
  P16: Fix return form field    ──┘

Phase 2: Hardening (P1) — Estimated 1-2 days
─────────────────────────────────────────────────
  M1: Rate limiting ──────────────┐
  M2: API retry logic ────────────┤
  P5: Remove duplicate routes ────┤
  P8/P9: Fix raw SQL ─────────────┤──► P19: Fix shipping_cost column
  P11: Error logging ─────────────┤
  P12: HPOS declaration ──────────┤
  E1/E6: Order notes ─────────────┤
  O3: Unreachable alert ──────────┤
  F1: Cache pickup address ───────┤
  P6/B2: Uninstall hook ──────────┘

Phase 3: Polish (P2) — Estimated 2-3 days
─────────────────────────────────────────────────
  All P2 items (non-blocking, can be done incrementally)

Phase 4: Testing (T1-T19) — Estimated 2-3 days
─────────────────────────────────────────────────
  Can begin in parallel with Phase 2
  T8 (parameter validation) should be done with Phase 1
```

---

## Appendix A: Complete Tool Inventory

| # | Tool Name | Module | Parameters | Plugin Uses? |
|---|-----------|--------|------------|--------------|
| 1 | `estimated_delivery` | serviceability | `delivery_pincode` | No |
| 2 | `shipping_rate_calculator` | serviceability | `pickup_postcode`, `delivery_postcode`, `weight_in_kg`, `cod_or_prepaid` | Yes (mismatch) |
| 3 | `get_order_detail` | orders | `order_id` (number) | No |
| 4 | `order_list` | orders | `status` (optional enum) | Yes |
| 5 | `order_create` | orders | 14 parameters | Yes (mismatch) |
| 6 | `order_cancel` | orders | `order_id`, `cancel_on_channel` | No |
| 7 | `order_track` | shipping | `awb_number` (regex) | Yes (mismatch) |
| 8 | `order_ship` | shipping | `order_id` (string), `courier_id` (optional number) | Yes (mismatch) |
| 9 | `order_schedule_pickup` | shipping | `order_id`, `pickup_date` | Yes (name mismatch) |
| 10 | `generate_shipment_label` | shipping | `shipment_id` (number) | Yes |
| 11 | `list_ndr` | ndr | none | No |
| 12 | `get_ndr` | ndr | `awb_number` | No |
| 13 | `reattempt_ndr` | ndr | `awb_number` + optional fields | Simulated |
| 14 | `mark_rto` | ndr | `awb_number`, `remarks` | No |
| 15 | `contact_buyer` | ndr | `awb_number`, `channel` | No |
| 16 | `list_returns` | returns | `page`, `per_page` | No |
| 17 | `create_return` | returns | 18 parameters | Simulated |
| 18 | `create_exchange` | returns | `return_id`, `exchange_reason`, `exchange_items` | No |
| 19 | `update_return` | returns | `return_id`, `order_items` | No |
| 20 | `cancel_return` | returns | `return_id` | No |
| 21 | `generate_manifest` | manifest | `shipment_ids` (array) | Simulated |
| 22 | `print_manifest` | manifest | `order_ids` (array) | No |
| 23 | `generate_invoice` | manifest | `order_ids` (array) | No |
| 24 | `list_pickup_addresses` | settings | none | Yes |

## Appendix B: Database Schema

```sql
-- Sync tracking
CREATE TABLE {prefix}_aargo_shiprocket_sync (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    wc_order_id bigint(20) unsigned NOT NULL,
    shiprocket_order_id varchar(100),
    awb_number varchar(100),
    courier_name varchar(100),
    status varchar(50),
    label_url varchar(500),
    manifest_url varchar(500),
    pickup_date date,
    delivered_date date,
    error_message text,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wc_order (wc_order_id),
    KEY idx_awb (awb_number),
    KEY idx_status (status),
    KEY idx_sr_order (shiprocket_order_id)
);

-- NDR tracking
CREATE TABLE {prefix}_aargo_shiprocket_ndr (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    wc_order_id bigint(20) unsigned NOT NULL,
    awb_number varchar(100),
    ndr_code varchar(50),
    ndr_reason text,
    action_taken varchar(50),
    resolved tinyint(1) DEFAULT 0,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wc_order (wc_order_id),
    KEY idx_awb (awb_number)
);

-- Returns
CREATE TABLE {prefix}_aargo_shiprocket_returns (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    wc_order_id bigint(20) unsigned NOT NULL,
    shiprocket_return_id varchar(100),
    return_type enum('return', 'exchange') DEFAULT 'return',
    status varchar(50),
    reason text,
    reason_category varchar(50),
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wc_order (wc_order_id)
);

-- Webhook log
CREATE TABLE {prefix}_aargo_shiprocket_webhooks (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    event_type varchar(100),
    payload longtext,
    processed tinyint(1) DEFAULT 0,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_event (event_type),
    KEY idx_processed (processed)
);
```

**Note:** The `aargo_shiprocket_sync` table is missing a `shipping_cost` column that `class-analytics.php` references. This needs to be added or the query needs to be fixed.

## Appendix C: WordPress Options Used

| Option | Default | Purpose |
|--------|---------|---------|
| `aargo_sr_mcp_url` | `http://localhost:3000` | MCP server URL |
| `aargo_sr_mcp_token` | `''` | MCP auth token |
| `aargo_sr_auto_sync` | `'yes'` | Auto-sync new orders |
| `aargo_sr_auto_ship` | `'no'` | Auto-ship after sync |
| `aargo_sr_pickup_postcode` | `'110001'` | Warehouse postcode |
| `aargo_sr_default_dimensions` | `{l:10, b:10, h:10}` | Default parcel dimensions |
| `aargo_sr_courier_history` | `array()` | Courier performance data |
| `aargo_sr_return_window` | `7` | Return window in days |

---

*End of Plan*
