import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import axios from "axios";
import { connectionsBySessionId } from "./connections";

export const initializeTools = (server: McpServer) => {
  server.tool(
    "order_tracker",
    `This tool provides order tracking related information.

    Args:
        track_id: Alphanumeric tracking ID which can be 'Order Id' or 'AWB number' or 'Channel Order Id'
    
    Returns: Dictionary containing following info:
        orderId: String representing order ID
        createdOn: Date formatted string representing order creation date
        orderStatus: String representing order status
        awbData: Optional dictionary if shipment is assigned to the order, containing following info:
            number: String representing AWB number of order
            lastActivity: String representing last marked activity of order
            lastScanLocation: String representing last marked location of order
            lastScanTime: Timestamp formatted string representing last order scan timestamp
            trackingUrl: String representing URL of order tracking page`,
    {
      track_id: zod.string(),
    },
    async ({ track_id: trackId }, context) => {
      const srApiDomain = "https://apiv2.shiprocket.in";

      const { sellerToken } = connectionsBySessionId[context.sessionId!];
      const trackUrl = `${srApiDomain}/v1/copilot/order/track/${trackId}`;
      const orderDetailUrl = `${srApiDomain}/v1/copilot/order/show/${trackId}`;

      try {
        const apiCalls: Promise<Record<string, any>>[] = [];

        apiCalls.push(
          axios.get(trackUrl, {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          })
        );

        apiCalls.push(
          axios.get(orderDetailUrl, {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          })
        );
        const [trackData, orderData] = await Promise.all(apiCalls);

        const orderTrackData: {
          orderId: string;
          createdOn: string;
          orderStatus: string;
          shipment_id?: string;
          awbData: {
            number: string;
            lastActivity: string;
            lastScanLocation: string;
            lastScanTime: string;
            trackingUrl: string;
          } | null;
        } = {
          orderId: orderData.data.data.id as string,
          createdOn: orderData.data.data.created_at as string,
          orderStatus: orderData.data.data.status as string,
          awbData: null,
        };

        if (
          trackData.data.tracking_data.track_status === 0 ||
          !("shipment_track_activities" in trackData.data.tracking_data) ||
          !Array.isArray(trackData.data.tracking_data.shipment_track_activities)
        ) {
          orderTrackData.awbData = null;
        } else {
          orderTrackData.awbData = {
            number: orderData.data.data.awb_data.awb as string,
            lastActivity: trackData.data.tracking_data
              .shipment_track_activities[0].activity as string,
            lastScanLocation: trackData.data.tracking_data
              .shipment_track_activities[0].location as string,
            lastScanTime: trackData.data.tracking_data
              .shipment_track_activities[0].date as string,
            trackingUrl: trackData.data.tracking_data.track_url as string,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(orderTrackData) }],
        };
      } catch (err) {
        if (err instanceof Error) {
          // this.handleAxiosAPIErrorLogging(err);
        }
        return {
          content: [
            {
              type: "text",
              text: `I couldn't find any data for the tracking ID you provided. Please double-check the ID and try again.`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "rate_calculator",
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
      const srApiDomain = "https://serviceability.shiprocket.in";

      const { sellerToken } = connectionsBySessionId[context.sessionId!];
      const url = `${srApiDomain}/courier/ratingserviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPostcode}&weight=${weight}&cod=${
        codOrPrepaid === "COD" ? 1 : 0
      }'`;

      try {
        const data = (
          await axios.get(url, {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          })
        ).data;

        const couriers = data.data.available_courier_companies.map(
          (courier: Record<string, unknown>) => ({
            courier_name: courier.courier_name,
            cutoff_time: courier.cutoff_time,
            etd: courier.etd,
            freight_charge: courier.freight_charge,
            transport_mode: courier.is_surface ? "SURFACE" : "AIR",
            rto_charges: courier.rto_charges,
          })
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(couriers),
            },
          ],
        };
      } catch (err) {
        if (err instanceof Error) {
          console.log(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: `Unable to fetch couriers due to some error`,
            },
          ],
        };
      }
    }
  );
};
