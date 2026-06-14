import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import { getOrCreateClient } from "@/mcp/connections";
import { globalSessionId } from "@/mcp/connections";
import { API_DOMAINS } from "@/config";
import { withToolErrorHandling } from "./utils";
import type { ShiprocketClient } from "@/api/client";
import type { ServiceabilityResponse } from "@/api/types";

function getClient(context: { sessionId?: string }): ShiprocketClient {
  return getOrCreateClient(context.sessionId ?? globalSessionId);
}

export function registerServiceabilityTools(server: McpServer): void {
  server.tool(
    "estimated_delivery",
    `Get the Estimated Date of Delivery (EDD) for a given destination.
    
    Args:
        delivery_pincode: String representing pincode of order delivery destination
    
    Returns: Dictionary containing following info: 
        estimated_delivery_date: Date-time formatted string representing expected date & time of delivery
        delivery_pincode: String representing pincode of order delivery destination`,
    {
      delivery_pincode: zod.string(),
    },
    async ({ delivery_pincode: deliveryPincode }, context) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const addressList = await client.get<{
          data: { shipping_address: Array<{ pin_code: string }> };
        }>(
          `${API_DOMAINS.SHIPROCKET}/v1/external/settings/company/pickup?limit=1&medium=shiprocketMCP`
        );

        const pickupPostcode =
          addressList?.data?.shipping_address?.[0]?.pin_code;

        if (!pickupPostcode) {
          throw new Error(
            "No pickup address configured. Please set up a pickup address in your Shiprocket account."
          );
        }

        const params = new URLSearchParams();
        params.append("pickup_postcode", pickupPostcode);
        params.append("delivery_postcode", deliveryPincode);
        params.append("weight", "0.5");
        params.append("cod", "0");
        params.append("medium", "shiprocketMCP");

        const serviceabilityData = await client.get<ServiceabilityResponse>(
          `${API_DOMAINS.SERVICEABILITY}/courier/ratingserviceability?${params.toString()}`
        );

        const couriers = serviceabilityData.data.available_courier_companies;
        if (!couriers || couriers.length === 0) {
          return {
            estimated_delivery_date: null,
            delivery_pincode: deliveryPincode,
            message: "No courier service available for this route",
          };
        }

        return {
          estimated_delivery_date: couriers[0].etd,
          delivery_pincode: deliveryPincode,
        };
      }, "Unable to fetch expected date of delivery due to some error");
    }
  );

  server.tool(
    "shipping_rate_calculator",
    `Get serviceable shipping couriers, their prices and EDDs (Estimated Delivery Dates).
    
    Args:
        pickup_postcode: String representing pincode of order pickup location
        delivery_postcode: String representing pincode of order delivery location
        weight_in_kg: String representing weight of the order package
        cod_or_prepaid: Enum('COD', 'PREPAID') representing mode of payment of the order
    
    Returns: List of dictionary containing following info:
        courier_name: String representing name of the courier
        cutoff_time: String representing time deadline for 
        etd: Date-time formatted string representing expected date & time of delivery
        freight_charge: Number represeting cost of shipment in Indian Rupees
        transport_mode: Enum('SURFACE', 'AIR') representing mode of transport
        rto_charges: Number represeting the cost (in Indian Rupees) associated with return shipment if order gets RTO`,
    {
      pickup_postcode: zod.string(),
      delivery_postcode: zod.string(),
      weight_in_kg: zod.number(),
      cod_or_prepaid: zod.string(zod.enum(["COD", "PREPAID"])),
    },
    async (
      {
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPostcode,
        weight_in_kg: weight,
        cod_or_prepaid: codOrPrepaid,
      },
      context
    ) => {
      const client = getClient(context);

      return withToolErrorHandling(async () => {
        const params = new URLSearchParams();
        params.append("medium", "shiprocketMCP");
        params.append("pickup_postcode", pickupPincode);
        params.append("delivery_postcode", deliveryPostcode);
        params.append("weight", String(weight));
        params.append("cod", codOrPrepaid === "COD" ? "1" : "0");

        const data = await client.get<ServiceabilityResponse>(
          `${API_DOMAINS.SERVICEABILITY}/courier/ratingserviceability?${params.toString()}`
        );

        const companies = data.data.available_courier_companies;
        if (!companies || companies.length === 0) {
          return {
            message: "No courier service available for this route",
            couriers: [],
          };
        }

        const couriers = companies.map((courier) => ({
          courier_name: courier.courier_name,
          cutoff_time: courier.cutoff_time,
          etd: courier.etd,
          freight_charge: courier.freight_charge,
          transport_mode: courier.is_surface ? "SURFACE" : "AIR",
          rto_charges: courier.rto_charges,
        }));

        return couriers;
      }, "Unable to fetch couriers due to some error");
    }
  );
}
