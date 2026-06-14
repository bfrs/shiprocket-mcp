import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools } from "../src/mcp/tools";

describe("Tool Registration", () => {
  it("should register all 24 tools with correct names", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    initializeTools(server);

    const registeredTools = (server as any)._registeredTools;
    const toolNames = Object.keys(registeredTools);

    const expectedTools = [
      "estimated_delivery",
      "shipping_rate_calculator",
      "get_order_detail",
      "order_list",
      "order_create",
      "order_cancel",
      "order_track",
      "order_ship",
      "order_schedule_pickup",
      "generate_shipment_label",
      "list_pickup_addresses",
      "list_ndr",
      "get_ndr",
      "reattempt_ndr",
      "mark_rto",
      "contact_buyer",
      "list_returns",
      "create_return",
      "create_exchange",
      "update_return",
      "cancel_return",
      "generate_manifest",
      "print_manifest",
      "generate_invoice",
    ];

    for (const toolName of expectedTools) {
      expect(toolNames).toContain(toolName);
    }
    expect(toolNames.length).toBe(expectedTools.length);
  });

  it("should have correct input schemas for key tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    initializeTools(server);

    const registeredTools = (server as any)._registeredTools;

    const orderList = registeredTools["order_list"];
    expect(orderList).toBeDefined();
    expect(orderList.inputSchema).toBeDefined();

    const orderTrack = registeredTools["order_track"];
    expect(orderTrack).toBeDefined();
    expect(orderTrack.inputSchema).toBeDefined();

    const orderShip = registeredTools["order_ship"];
    expect(orderShip).toBeDefined();
    expect(orderShip.inputSchema).toBeDefined();

    const generateManifest = registeredTools["generate_manifest"];
    expect(generateManifest).toBeDefined();
    expect(generateManifest.inputSchema).toBeDefined();
  });
});
