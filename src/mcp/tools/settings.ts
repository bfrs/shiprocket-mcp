import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOrCreateClient, globalSessionId } from "@/mcp/connections";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerSettingsTools(server: McpServer): void {
  server.tool(
    "list_pickup_addresses",
    `Get all the pickup address of the seller

    Returns: List of dictionary representing pickup addresses of seller with following info:
        pickup_address_id: Number representing pickup address ID
        pickup_location_nickname: String representing short nickname of pickup location
        address: String representing pickup address line
        city: String representing pickup address city
        state: String representing pickup address state
        country: String representing pickup address country
        pincode: 6-digit number representing pickup address pincode`,
    {},
    async (_args, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const data = await client.get<{
          data: {
            shipping_address: Array<{
              id: number;
              pickup_location: string;
              address: string;
              city: string;
              state: string;
              country: string;
              pin_code: number;
            }>;
          };
        }>(
          `/v1/external/settings/company/pickup?medium=shiprocketMCP`
        );

        return data?.data?.shipping_address?.slice(0, 10)?.map((address) => ({
          pickup_address_id: address.id,
          pickup_location_nickname: address.pickup_location,
          address: address.address,
          city: address.city,
          state: address.state,
          country: address.country,
          pincode: address.pin_code,
        }));
      }, "Unable to fetch pickup addresses due to some error occurred");
    }
  );
}
