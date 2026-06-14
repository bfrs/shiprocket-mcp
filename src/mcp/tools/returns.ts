import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";
import type { ReturnOrder } from "@/api/types";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerReturnTools(server: McpServer): void {
  server.tool(
    "list_returns",
    `Get all return orders.

    Args:
        page: Optional page number for pagination
        per_page: Optional number of items per page

    Returns: List of return orders`,
    {
      page: zod.number().optional(),
      per_page: zod.number().optional(),
    },
    async ({ page, per_page }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const params = new URLSearchParams();
        params.append("medium", "shiprocketMCP");
        if (page) params.append("page", page.toString());
        if (per_page) params.append("per_page", per_page.toString());

        const data = await client.get<{
          data: ReturnOrder[];
        }>(
          `/v1/external/orders/processing/return?${params.toString()}`
        );

        return data.data;
      }, "Unable to fetch return orders due to some error");
    }
  );

  server.tool(
    "create_return",
    `Create a return order.

    Args:
        order_id: String representing order ID
        order_date: Date string (YYYY-MM-DD)
        pickup_customer_name: String representing buyer's name
        pickup_address: String representing buyer's address
        pickup_city: String representing buyer's city
        pickup_state: String representing buyer's state
        pickup_country: String representing buyer's country
        pickup_pincode: Number representing buyer's pincode
        pickup_email: String representing buyer's email
        pickup_phone: String representing buyer's phone
        shipping_customer_name: String representing seller's name
        shipping_address: String representing seller's address
        shipping_city: String representing seller's city
        shipping_state: String representing seller's state
        shipping_country: String representing seller's country
        shipping_pincode: Number representing seller's pincode
        shipping_phone: String representing seller's phone
        order_items: List of order items
        payment_method: Enum('COD', 'PREPAID')
        sub_total: Number representing subtotal
        length: Number in cm
        breadth: Number in cm
        height: Number in cm
        weight: Number in kg

    Returns: Return order details`,
    {
      order_id: zod.string(),
      order_date: zod.string(),
      pickup_customer_name: zod.string(),
      pickup_address: zod.string(),
      pickup_city: zod.string(),
      pickup_state: zod.string(),
      pickup_country: zod.string(),
      pickup_pincode: zod.string().regex(/^\d{6}$/, "Pincode must be a 6-digit number"),
      pickup_email: zod.string().email(),
      pickup_phone: zod.string().regex(/^\d{10}$/, "Phone must be a 10-digit number"),
      shipping_customer_name: zod.string(),
      shipping_address: zod.string(),
      shipping_city: zod.string(),
      shipping_state: zod.string(),
      shipping_country: zod.string(),
      shipping_pincode: zod.string().regex(/^\d{6}$/, "Pincode must be a 6-digit number"),
      shipping_phone: zod.string(),
      order_items: zod.array(
        zod.object({
          name: zod.string(),
          sku: zod.string(),
          units: zod.number(),
          selling_price: zod.number(),
        })
      ),
      payment_method: zod.enum(["COD", "PREPAID"]),
      sub_total: zod.number(),
      length: zod.number(),
      breadth: zod.number(),
      height: zod.number(),
      weight: zod.number(),
    },
    async (args, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          return_id: number;
          order_id: string;
          status: string;
        }>(
          `/v1/external/orders/create/return`,
          {
            ...args,
            medium: "shiprocketMCP",
          }
        );

        return data;
      }, "Unable to create return order due to some error");
    }
  );

  server.tool(
    "create_exchange",
    `Create an exchange order.

    Args:
        return_id: Number representing return ID
        exchange_reason: String representing reason for exchange
        exchange_items: List of items to exchange

    Returns: Exchange order details`,
    {
      return_id: zod.number(),
      exchange_reason: zod.string(),
      exchange_items: zod.array(
        zod.object({
          product_id: zod.number(),
          name: zod.string(),
          sku: zod.string(),
          units: zod.number(),
          selling_price: zod.number(),
        })
      ),
    },
    async ({ return_id, exchange_reason, exchange_items }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          return_id: number;
          order_id: string;
          status: string;
        }>(`/v1/external/returns/exchange`, {
          return_id,
          exchange_reason,
          exchange_items,
          medium: "shiprocketMCP",
        });

        return data;
      }, "Unable to create exchange order due to some error");
    }
  );

  server.tool(
    "update_return",
    `Update a return order.

    Args:
        return_id: Number representing return ID
        order_items: Optional updated list of order items

    Returns: Updated return order details`,
    {
      return_id: zod.number(),
      order_items: zod
        .array(
          zod.object({
            product_id: zod.number(),
            name: zod.string(),
            sku: zod.string(),
            units: zod.number(),
            selling_price: zod.number(),
          })
        )
        .optional(),
    },
    async ({ return_id, order_items }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          return_id: number;
          status: string;
        }>(`/v1/external/returns/update`, {
          return_id,
          order_items,
          medium: "shiprocketMCP",
        });

        return data;
      }, "Unable to update return order due to some error");
    }
  );

  server.tool(
    "cancel_return",
    `Cancel a return order.

    Args:
        return_id: Number representing return ID

    Returns: Success status and message`,
    {
      return_id: zod.number(),
    },
    async ({ return_id }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          status: string;
          message: string;
        }>(`/v1/external/returns/cancel`, {
          return_id,
          medium: "shiprocketMCP",
        });

        return data;
      }, "Unable to cancel return order due to some error");
    }
  );
}
