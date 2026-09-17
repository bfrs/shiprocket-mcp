import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMcpServer } from "./index";
import { connectionsBySessionId, globalSessionId } from "./connections";
import type { Scope } from "@/oauth/scopes";

const READ_TOOLS = [
  "estimated_delivery",
  "generate_shipment_label",
  "list_pickup_addresses",
  "order_list",
  "order_track",
  "shipping_rate_calculator",
];
const WRITE_TOOLS = ["order_cancel", "order_create", "order_schedule_pickup", "order_ship"];

// The in-memory transport carries no sessionId, so tools resolve the session
// through globalSessionId — the same path stdio uses.
async function connect(scopes: Scope[]): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  connectionsBySessionId[globalSessionId] = {
    transport: serverTransport as never,
    sellerToken: "seller.jwt",
    scopes: new Set(scopes),
  };
  await createMcpServer(scopes).connect(serverTransport);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
  return client;
}

async function listNames(client: Client): Promise<string[]> {
  return (await client.listTools()).tools.map((t) => t.name).sort();
}

describe("scope enforcement", () => {
  beforeEach(() => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("upstream must not be called"));
    vi.spyOn(axios, "post").mockRejectedValue(new Error("upstream must not be called"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete connectionsBySessionId[globalSessionId];
    vi.restoreAllMocks();
  });

  it("lists only read tools for a seller:read grant", async () => {
    const client = await connect(["seller:read"]);
    expect(await listNames(client)).toEqual(READ_TOOLS);
  });

  it("lists every tool for a read+write grant", async () => {
    const client = await connect(["seller:read", "seller:write"]);
    expect(await listNames(client)).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
  });

  it("lists nothing when no scope was granted", async () => {
    const client = await connect([]);
    expect(await listNames(client)).toEqual([]);
  });

  it("rejects a hidden write tool at the protocol level before any upstream call", async () => {
    const client = await connect(["seller:read"]);
    await expect(client.callTool({ name: "order_cancel", arguments: { order_id: 1 } })).rejects.toThrow(/disabled/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("returns insufficient_scope when the session's grant is narrower than the server's", async () => {
    const client = await connect(["seller:read", "seller:write"]);
    connectionsBySessionId[globalSessionId].scopes = new Set(["seller:read"]);

    const result = await client.callTool({ name: "order_ship", arguments: { order_id: "1" } });

    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0].text).toMatch(/insufficient_scope.*seller:write/);
    const hint = (result._meta as { "mcp/www_authenticate": string[] })["mcp/www_authenticate"][0];
    expect(hint).toContain('error="insufficient_scope"');
    expect(hint).toContain('scope="seller:write"');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("denies everything when the session record is missing", async () => {
    const client = await connect(["seller:read"]);
    delete connectionsBySessionId[globalSessionId];

    const result = await client.callTool({ name: "order_track", arguments: { awb_number: "1" } });

    expect(result.isError).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("lets a permitted tool through to its handler", async () => {
    const client = await connect(["seller:read"]);
    await client.callTool({ name: "order_track", arguments: { awb_number: "AWB1" } });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect((axios.get as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("/courier/track/awb/AWB1");
  });
});
