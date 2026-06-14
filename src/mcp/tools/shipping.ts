import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";
import type { TrackingData } from "@/api/types";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerShippingTools(server: McpServer): void {
  server.tool(
    "order_track",
    `Get order tracking related information.

    Args:
        awb_number: String representing AWB number assigned to the order
    
    Returns: Dictionary containing following info:
        order_status: String representing order status
        awb_number: String representing AWB number of order
        last_activity: String representing last marked activity of order
        last_scan_location: String representing last marked location of order
        last_scan_time: Timestamp formatted string representing last order scan timestamp
        tracking_url: String representing URL of order tracking page`,
    {
      awb_number: zod.string().regex(/^[A-Za-z0-9]+$/, "AWB must be alphanumeric"),
    },
    async ({ awb_number: awbNumber }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const trackData = await client.get<{
          tracking_data: TrackingData;
        }>(
          `/v1/external/courier/track/awb/${awbNumber}?medium=shiprocketMCP`
        );

        const data = trackData?.tracking_data;

        if (data && "error" in data && data.error) {
          return {
            success: false,
            error: data.error,
          };
        }

        return {
          number: awbNumber,
          order_status: data.shipment_track[0]?.current_status,
          last_activity: data?.shipment_track_activities?.[0]?.activity ?? null,
          last_scan_location:
            data?.shipment_track_activities?.[0]?.location ?? null,
          last_scan_time: data?.shipment_track_activities?.[0]?.date ?? null,
          tracking_url: data?.track_url,
        };
      }, "I couldn't find any data for the tracking ID you provided. Please double-check the ID and try again.");
    }
  );

  server.tool(
    "order_ship",
    `Ship order by assigning courier to the order

    Args:
        order_id: Alphanumeric ID which can be 'Order ID' or 'Channel Order ID' or 'Shipment ID'
        courier_id: Optional number representing courier ID to assign shipment
        
    Returns: Dictionary containing success status and a status message`,
    {
      order_id: zod.string().min(1),
      courier_id: zod.number().optional(),
    },
    async ({ order_id: orderId, courier_id: courierId }, context) => {
      const client = getClient(context);
      const trimmedOrderId = orderId.trim();

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          response: {
            data: {
              courier_name: string;
              awb_code: string;
            };
          };
        }>(`/v1/external/courier/assign/awb`, {
          oid: isNaN(Number(trimmedOrderId))
            ? trimmedOrderId
            : parseInt(trimmedOrderId),
          courier_id: courierId,
          medium: "shiprocketMCP",
        });

        return {
          success: true,
          message: `Shipment assigned to ${data?.response?.data?.courier_name} with AWB code ${data?.response?.data?.awb_code}`,
        };
      }, "Unable to assign courier due to some error occurred");
    }
  );

  server.tool(
    "order_schedule_pickup",
    `Schedule pickup for the order shipment

    Args:
        order_id: Alphanumeric ID which can be 'Order ID' or 'Channel Order ID' or 'Shipment ID'
        pickup_date: Date formatted ('YYYY-MM-DD') string representing date on which pickup will be scheduled

    Returns: Dictionary containing success status and a status message`,
    {
      order_id: zod.string().min(1),
      pickup_date: zod.string(),
    },
    async ({ order_id: orderId, pickup_date: pickupDate }, context) => {
      const client = getClient(context);
      const trimmedOrderId = orderId.trim();

      return withToolErrorHandling(async () => {
        await client.post(
          `/v1/external/courier/generate/pickup`,
          {
            oid: isNaN(Number(trimmedOrderId))
              ? trimmedOrderId
              : parseInt(trimmedOrderId),
            pickup_date: [pickupDate],
            medium: "shiprocketMCP",
          }
        );

        return {
          success: true,
          message: `Shipment's pickup is scheduled on date ${pickupDate}`,
        };
      }, "Unable to schedule your pickup due to some error occurred");
    }
  );

  server.tool(
    "generate_shipment_label",
    `Generate shipment label and get the link of generated label as PDF file

    Returns:
        file_url: String representing URL of generated label`,
    { shipment_id: zod.number() },
    async ({ shipment_id: shipmentId }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          label_url: string;
        }>(
          `/v1/external/courier/generate/label`,
          {
            shipment_id: [shipmentId],
            medium: "shiprocketMCP",
          }
        );

        return {
          file_url: data.label_url,
        };
      }, "Unable to generate shipment label due to some error occurred");
    }
  );
}
