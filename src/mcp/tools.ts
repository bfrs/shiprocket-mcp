import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
import axios from "axios";
import { connectionsBySessionId, globalSessionId } from "./connections";
import { AxiosError } from "axios";

export const initializeTools = (server: McpServer) => {
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
      const srServiceabilityApiDomain = "https://serviceability.shiprocket.in";
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];

      const listAddressUrl = `${srApiDomain}/v1/settings/company/pickup?limit=1`;

      const addressList = (
        await axios.get(listAddressUrl, {
          headers: {
            Authorization: `Bearer ${sellerToken}`,
            "Content-Type": "application/json",
          },
        })
      ).data;

      const pickupPostcode =
        addressList?.data?.shipping_address?.[0]?.pin_code ?? "110092";

      const serviceabilityUrl = `${srServiceabilityApiDomain}/courier/ratingserviceability?pickup_postcode=${pickupPostcode}&delivery_postcode=${deliveryPincode}&weight=0.5&cod=0'`;

      try {
        const serviceabilityData = (
          await axios.get(serviceabilityUrl, {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          })
        ).data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                estimated_delivery_date:
                  serviceabilityData.data.available_courier_companies[0].etd,
                delivery_pincode: deliveryPincode,
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: `Unable to fetch expected date of delivery due to some error`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "order_track",
    `Get order tracking related information.

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
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
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
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
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
      const srApiDomain = "https://serviceability.shiprocket.in";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
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
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
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

  server.tool(
    "order_ship",
    `Assign courier to ship the order

    Args:
        shipment_id: Number representing order's shipment ID
        courier_id: Optional number representing courier ID to assign shipment
        
    Returns: Dictionary containing success status and a status message`,
    {
      shipment_id: zod.number(),
      courier_id: zod.number().optional(),
    },
    async ({ shipment_id: shipmentId, courier_id: courierId }, context) => {
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
      const url = `${srApiDomain}/v1/courier/assign/awb`;

      try {
        const data = (
          await axios.post(
            url,
            {
              shipment_id: [shipmentId],
              courier_id: courierId,
            },
            {
              headers: {
                Authorization: `Bearer ${sellerToken}`,
                "Content-Type": "application/json",
              },
            }
          )
        ).data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Shipment assigned to ${data?.response?.data?.courier_name} with AWB code ${data?.response?.data?.awb_code}`,
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `Unable to assign courier due to some error occurred`,
              }),
            },
          ],
        };
      }
    }
  );

  server.tool(
    "order_schedule_pickup",
    `Schedule pickup for the order shipment

    Args:
        shipment_id: String representing order's shipment ID
        pickup_date: Date formatted ('YYYY-MM-DD') string representing date on which pickup will be scheduled
        
    Returns: Dictionary containing success status and a status message`,
    {
      shipment_id: zod.number(),
      pickup_date: zod.string(),
    },
    async ({ shipment_id: shipmentId, pickup_date: pickupDate }, context) => {
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
      const url = `${srApiDomain}/v1/courier/generate/pickup`;

      try {
        await axios.post(
          url,
          {
            shipment_id: [shipmentId],
            pickup_date: [pickupDate],
          },
          {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Shipment's pickup is scheduled on date ${pickupDate}`,
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `Unable to schedule your pickup due to some error occurred`,
              }),
            },
          ],
        };
      }
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
    async (
      { order_id: orderId, cancel_on_channel: cancelOnChannel },
      context
    ) => {
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
      const url = `${srApiDomain}/v1/orders/cancel`;

      try {
        await axios.post(
          url,
          {
            ids: [orderId],
            cancel_on_channel: cancelOnChannel,
          },
          {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Order cancelled successfully`,
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `Unable to cancel your order due to some error occurred`,
              }),
            },
          ],
        };
      }
    }
  );

  server.tool(
    `order_create`,
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
      customer_phone: zod.number(),
      delivery_address: zod.string(),
      delivery_city: zod.string(),
      delivery_pincode: zod.number(),
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
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
      const url = `${srApiDomain}/v1/orders/create/adhoc`;

      try {
        const data = (
          await axios.post(
            url,
            {
              order_id: `MCP-${Date.now()}-${Math.floor(Math.random() * 10000)
                .toString()
                .padStart(4)}`,
              order_date: new Date().toLocaleDateString("en-CA"),
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
            },
            {
              headers: {
                Authorization: `Bearer ${sellerToken}`,
                "Content-Type": "application/json",
              },
            }
          )
        ).data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Order created successfully with Order Id: ${data.order_id}`,
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `Unable to create your order due to some error occurred`,
              }),
            },
          ],
        };
      }
    }
  );

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
    async (args, context) => {
      const srApiDomain = "https://apiv2.shiprocket.co";

      const { sellerToken } =
        connectionsBySessionId[context.sessionId ?? globalSessionId];
      const url = `${srApiDomain}/v1/settings/company/pickup`;

      try {
        const data = (
          await axios.get(url, {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
              "Content-Type": "application/json",
            },
          })
        ).data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                data?.data?.shipping_address
                  ?.slice(0, 10)
                  ?.map((address: Record<string, unknown>) => ({
                    pickup_address_id: address.id,
                    pickup_location_nickname: address.pickup_location,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    country: address.country,
                    pincode: address.pin_code,
                  }))
              ),
            },
          ],
        };
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error(err.response?.data);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: err.response?.data,
                }),
              },
            ],
          };
        } else if (err instanceof Error) {
          console.error(err.stack);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `Unable to fetch pickup addresses due to some error occurred`,
              }),
            },
          ],
        };
      }
    }
  );
};
