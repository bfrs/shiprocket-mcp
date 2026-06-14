import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";
import type { NdrShipment } from "@/api/types";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerNdrTools(server: McpServer): void {
  server.tool(
    "list_ndr",
    `Get all NDR (Non-Delivery Report) shipments.

    Returns: List of NDR shipments with details like AWB, status, reason, and customer info.`,
    {},
    async (_args, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.get<{
          data: NdrShipment[];
        }>(`/v1/external/ndr/all`);

        return data.data;
      }, "Unable to fetch NDR shipments due to some error");
    }
  );

  server.tool(
    "get_ndr",
    `Get specific NDR shipment details by AWB number.

    Args:
        awb_number: String representing AWB number of the NDR shipment

    Returns: NDR shipment details`,
    {
      awb_number: zod.string().regex(/^[A-Za-z0-9]+$/, "AWB must be alphanumeric"),
    },
    async ({ awb_number: awbNumber }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.get<{
          data: NdrShipment;
        }>(`/v1/external/ndr/${awbNumber}`);

        return data.data;
      }, "Unable to fetch NDR details due to some error");
    }
  );

  server.tool(
    "reattempt_ndr",
    `Reattempt delivery for an NDR shipment.

    Args:
        awb_number: String representing AWB number
        address_1: Optional updated address line 1
        address_2: Optional updated address line 2
        phone: Optional updated phone number
        deferred_date: Optional date for reattempt (YYYY-MM-DD)

    Returns: Success status and message`,
    {
      awb_number: zod.string().regex(/^[A-Za-z0-9]+$/, "AWB must be alphanumeric"),
      address_1: zod.string().optional(),
      address_2: zod.string().optional(),
      phone: zod.string().optional(),
      deferred_date: zod.string().optional(),
    },
    async (
      { awb_number: awbNumber, address_1, address_2, phone, deferred_date },
      context
    ) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const body: Record<string, string> = { awb: awbNumber };
        if (address_1) body.address_1 = address_1;
        if (address_2) body.address2 = address_2;
        if (phone) body.phone = phone;
        if (deferred_date) body.deferred_date = deferred_date;

        const data = await client.post<{
          status: string;
          message: string;
        }>(`/v1/external/ndr/reattempt`, body);

        return data;
      }, "Unable to schedule reattempt due to some error");
    }
  );

  server.tool(
    "mark_rto",
    `Mark an NDR shipment for RTO (Return to Origin).

    Args:
        awb_number: String representing AWB number
        remarks: Optional remarks for RTO

    Returns: Success status and message`,
    {
      awb_number: zod.string().regex(/^[A-Za-z0-9]+$/, "AWB must be alphanumeric"),
      remarks: zod.string().optional(),
    },
    async ({ awb_number: awbNumber, remarks }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          status: string;
          message: string;
        }>(`/v1/external/ndr/rto`, {
          awb: awbNumber,
          remarks,
        });

        return data;
      }, "Unable to mark RTO due to some error");
    }
  );

  server.tool(
    "contact_buyer",
    `Contact buyer for an NDR shipment via SMS, call, or missed call.

    Args:
        awb_number: String representing AWB number
        channel: Enum('sms', 'call', 'missed_call') representing contact method

    Returns: Success status and message`,
    {
      awb_number: zod.string().regex(/^[A-Za-z0-9]+$/, "AWB must be alphanumeric"),
      channel: zod.enum(["sms", "call", "missed_call"]),
    },
    async ({ awb_number: awbNumber, channel }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          status: string;
          message: string;
        }>(`/v1/external/ndr/contact-buyer`, {
          awb: awbNumber,
          action: channel,
        });

        return data;
      }, "Unable to contact buyer due to some error");
    }
  );
}
