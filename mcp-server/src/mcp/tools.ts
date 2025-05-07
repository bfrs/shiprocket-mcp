import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import axios from "axios";
import { connectionsBySessionId } from "./connections";

export const initializeTools = (server: McpServer) => {
  server.tool(
    "order_tracker",
    `This tool provides order tracking related information`,
    {
      track_id: zod.string(),
    },
    async ({ track_id: trackId }, context) => {
      const srApiDomain = "https://apiv2.shiprocket.in";

      const { sellerToken } = connectionsBySessionId[context.sessionId!];
      console.log(connectionsBySessionId, context);
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
          awbData: {
            number: string;
            lastStatus: string;
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
            lastStatus: trackData.data.tracking_data
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
};
