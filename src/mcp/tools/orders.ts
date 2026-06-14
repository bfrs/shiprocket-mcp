import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { randomUUID } from "node:crypto";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerOrderTools(server: McpServer): void {
  server.tool(
    "get_order_detail",
    `Get full details of an order by ID.

    Args:
        order_id: Number representing Shiprocket order ID

    Returns: Complete order details including tracking info if available`,
    {
      order_id: zod.number(),
    },
    async ({ order_id: orderId }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.get<{
          data: Record<string, unknown>;
        }>(
          `/v1/external/orders/show/${orderId}?medium=shiprocketMCP`
        );

        return data?.data ?? {};
      }, "Unable to fetch order details due to some error");
    }
  );

  server.tool(
    "order_list",
    `Get list of orders
    
    Args:
        status: Optional ENUM('NEW', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED') representing status filter for orders
        
    Return: List of dictionary containing following info:
        `,
    {
      status: zod
        .string(
          zod.enum([
            "CANCELLED",
            "NEW",
            "READY_TO_SHIP",
            "IN_TRANSIT",
            "DELIVERED",
            "RTO",
          ])
        )
        .optional(),
    },
    async ({ status }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        let concatenatedStatusIds = "";

        switch (status) {
          case "NEW":
            concatenatedStatusIds = "1";
            break;
          case "CANCELLED":
            concatenatedStatusIds = "5,18";
            break;
          case "READY_TO_SHIP":
            concatenatedStatusIds = "34,14,35,12,13,3,4";
            break;
          case "IN_TRANSIT":
            concatenatedStatusIds = "37,20,44,19,51,43,6";
            break;
          case "DELIVERED":
            concatenatedStatusIds = "7";
            break;
          case "RTO":
            concatenatedStatusIds = "15,55,46,45,16,17,36,87,85";
            break;
        }

        const params = new URLSearchParams();
        params.append("medium", "shiprocketMCP");
        if (status) {
          params.append("filter", concatenatedStatusIds);
          params.append("filter_by", "status");
        }

        const data = await client.get<{
          data: Array<Record<string, unknown>>;
        }>(`/v1/external/orders?${params.toString()}`);

        const structuredOrders = data?.data?.map((order) => ({
          order_id: order.id,
          channel_name: order.channel_name,
          channel_order_id: order.channel_order_id,
          customer_name: order.customer_name,
          order_total_cost: order.total,
          status: order.status,
          order_created_at: order.channel_created_at,
          products: Array.isArray(order.products)
            ? order.products.map((product: Record<string, unknown>) => ({
                name: product.name,
                product_sku: product.channel_sku,
                quantity: product.quantity,
              }))
            : [],
          shipment_id: Array.isArray(order.shipments)
            ? order.shipments?.[0]?.id
            : null,
          shipping_courier_name: Array.isArray(order.shipments)
            ? order.shipments?.[0]?.courier
            : null,
          awb_number: Array.isArray(order.shipments)
            ? order.shipments?.[0]?.awb
            : null,
          payment_mode: order.cod === 1 ? "COD" : "PREPAID",
        }));

        return structuredOrders ?? [];
      }, "Unable to fetch orders due to some error occurred");
    }
  );

  server.tool(
    "order_create",
    `Create order

    Args:
        pickup_location_nickname: String representing short nickname of pickup location
        customer_name: String representing name of the customer who placed order
        customer_email: String representing email of the customer who placed order
        customer_phone: 10-digit number representing phone number of the customer who placed order
        delivery_address: String representing customer address on which order will be delivered
        delivery_city: String representing city of delivery address
        delivery_pincode: 6-digit number representing pincode of delivery address
        delivery_state: String representing state of delivery address
        delivery_country: String representing country of delivery address
        length:	Number representing length of the order package in centimeters
        breadth: Number representing breadth of the order package in centimeters
        height:	Number representing height of the order package in centimeters
        weight: Number representing wight of the order package in kilograms
        mode_of_payment: Enum('COD', 'PREPAID') representing mode of payment for the order
        order_items: List of dictionary containing following info of each product in the order:
            name: String representing name of the product item
            sku: String representing SKU of the product item
            units: Number representing quantity of product ordered
            selling_price: Number representing price of product ordered

    Returns: Dictionary containing success status and a status message`,
    {
      pickup_location: zod.string(),
      customer_name: zod.string(),
      customer_email: zod.string().email(),
      customer_phone: zod.string().regex(/^\d{10}$/, "Phone must be a 10-digit number"),
      delivery_address: zod.string(),
      delivery_city: zod.string(),
      delivery_pincode: zod.string().regex(/^\d{6}$/, "Pincode must be a 6-digit number"),
      delivery_state: zod.string(),
      delivery_country: zod.string().default("India"),
      length: zod.number(),
      breadth: zod.number(),
      height: zod.number(),
      weight: zod.number(),
      mode_of_payment: zod.string(zod.enum(["COD", "PREPAID"])),
      order_items: zod.array(
        zod.object({
          name: zod.string(),
          sku: zod.string(),
          units: zod.number(),
          selling_price: zod.number(),
        })
      ),
    },
    async (args, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.post<{
          order_id: string;
        }>(
          `/v1/external/orders/create/adhoc`,
          {
            order_id: `MCP-${randomUUID()}`,
            order_date: new Date().toISOString().slice(0, 10),
            pickup_location: args.pickup_location,
            billing_customer_name: args.customer_name,
            billing_address: args.delivery_address,
            billing_city: args.delivery_city,
            billing_pincode: args.delivery_pincode,
            billing_state: args.delivery_state,
            billing_country: args.delivery_country,
            billing_email: args.customer_email,
            billing_phone: args.customer_phone,
            shipping_is_billing: true,
            order_items: args.order_items,
            payment_method: args.mode_of_payment,
            sub_total: args.order_items.reduce(
              (acc, item) => acc + item.selling_price * item.units,
              0
            ),
            length: args.length,
            breadth: args.breadth,
            height: args.height,
            weight: args.weight,
            medium: "shiprocketMCP",
          }
        );

        return {
          success: true,
          message: `Order created successfully with Order Id: ${data.order_id}`,
        };
      }, "Unable to create your order due to some error occurred");
    }
  );

  server.tool(
    "order_cancel",
    `Cancel order

    Args:
        order_id: Number representing order ID
        cancel_on_channel: Optional boolean representing if the order should also be cancelled on the original channel
        
    Returns: Dictionary containing success status and a status message`,
    {
      order_id: zod.number(),
      cancel_on_channel: zod.boolean().default(true),
    },
    async ({ order_id: orderId, cancel_on_channel: cancelOnChannel }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        await client.post(`/v1/external/orders/cancel`, {
          ids: [orderId],
          cancel_on_channel: cancelOnChannel,
          medium: "shiprocketMCP",
        });

        return {
          success: true,
          message: `Order cancelled successfully`,
        };
      }, "Unable to cancel your order due to some error occurred");
    }
  );
}
