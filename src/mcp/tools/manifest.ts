import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";
import type { ManifestResponse, InvoiceResponse } from "@/api/types";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerManifestTools(server: McpServer): void {
  server.tool(
    "generate_manifest",
    `Generate a manifest for shipments.

    Args:
        shipment_ids: List of shipment IDs to include in manifest

    Returns: Manifest generation status and processed shipment IDs`,
    {
      shipment_ids: zod.array(zod.number()),
    },
    async ({ shipment_ids }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<ManifestResponse>(
          `/v1/external/manifests/generate`,
          {
            shipment_id: shipment_ids,
            medium: "shiprocketMCP",
          }
        );

        return data;
      }, "Unable to generate manifest due to some error");
    }
  );

  server.tool(
    "print_manifest",
    `Print a manifest and get the PDF URL.

    Args:
        order_ids: List of order IDs to print manifest for

    Returns: Manifest PDF URL`,
    {
      order_ids: zod.array(zod.number()),
    },
    async ({ order_ids }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          manifest_url: string;
        }>(
          `/v1/external/manifests/print`,
          {
            order_ids,
            medium: "shiprocketMCP",
          }
        );

        return data;
      }, "Unable to print manifest due to some error");
    }
  );
}

export function registerInvoiceTools(server: McpServer): void {
  server.tool(
    "generate_invoice",
    `Generate invoice for orders and get the PDF URL.

    Args:
        order_ids: List of order IDs to generate invoice for

    Returns: Invoice PDF URL and processed order IDs`,
    {
      order_ids: zod.array(zod.number()),
    },
    async ({ order_ids }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<InvoiceResponse>(
          `/v1/external/orders/print/invoice`,
          {
            ids: order_ids,
            medium: "shiprocketMCP",
          }
        );

        return data;
      }, "Unable to generate invoice due to some error");
    }
  );
}
