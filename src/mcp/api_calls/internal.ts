import axios from "axios";
import { handleAxiosAPIErrorLogging } from "./utils";
import moment from "moment";
import { API_DOMAINS, SR_APP_DOMAIN } from "@/config";
import { WeaviateService } from "@/services/weaviate";
import { WeaviateReturn } from "weaviate-client";

export const fetchRelevantShiprocketKnowledgebase = async (args: {
  query: string;
  source?: string;
}) => {
  try {
    type KBIndexProperties = {
      chunk: string;
      doc: string;
      namespace: string;
    };

    type KBDoc = {
      content: string;
      source: string;
    };

    const textToSearch =
      args.query + (args.source ? ` [ ${args.source} ]` : "");
    const weaviateIndex = WeaviateService.getInstance().client.collections.get(
      process.env.WEAVIATE_SHIPROCKET_KB_INDEX_NAME!
    );

    let chunks: WeaviateReturn<KBIndexProperties> = {
      objects: [],
    };

    chunks = (await weaviateIndex.query.hybrid(textToSearch, {
      returnMetadata: ["certainty"],
      limit: 10,
      returnProperties: ["doc", "namespace"],
      alpha: 0.6,
      filters: weaviateIndex.filter.byProperty("namespace").like("faq_*"),
    })) as WeaviateReturn<KBIndexProperties>;

    if (chunks.objects.length === 0) {
      chunks = (await weaviateIndex.query.hybrid(textToSearch, {
        returnMetadata: ["certainty"],
        limit: 10,
        returnProperties: ["doc", "namespace"],
        alpha: 0.75,
        filters: weaviateIndex.filter.byProperty("namespace").like("blog_*"),
      })) as WeaviateReturn<KBIndexProperties>;
    }

    const docsFromKB = (
      Array.from(
        chunks.objects.reduce((acc, doc) => {
          acc.add(
            JSON.stringify({
              source: doc.properties.namespace,
              content: doc.properties.doc,
            })
          );
          return acc;
        }, new Set())
      ).slice(0, 5) as string[]
    ).map((stringifyDoc) => JSON.parse(stringifyDoc)) as KBDoc[];

    return docsFromKB.map((doc) => doc.content).join("\n\n");
  } catch (err) {
    if (err instanceof Error) {
      console.log(err.stack);
    }
    return "";
  }
};

export const trackOrderByAWB = async (
  args: { track_id: string },
  srToken: string
) => {
  const trackUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/track/${args.track_id}`;
  const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.track_id}`;

  try {
    const apiCalls: Promise<Record<string, any>>[] = [];
    apiCalls.push(
      axios.get(trackUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    );
    apiCalls.push(
      axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    );
    const [trackData, orderData] = await Promise.all(apiCalls);

    const orderTrackData: {
      order_id: string;
      created_on: string;
      order_status: string;
      shipment_id: number;
      awb_data: {
        number: string;
        last_activity: string;
        last_scan_location: string;
        last_scan_time: string;
        tracking_url: string;
      } | null;
    } = {
      order_id: orderData.data.data.id as string,
      created_on: orderData.data.data.created_at as string,
      order_status: orderData.data.data.status as string,
      shipment_id: orderData.data.data.shipments.id as number,
      awb_data: null,
    };

    if (
      trackData.data.tracking_data.track_status === 0 ||
      !("shipment_track_activities" in trackData.data.tracking_data) ||
      !Array.isArray(trackData.data.tracking_data.shipment_track_activities)
    ) {
      orderTrackData.awb_data = null;
    } else {
      orderTrackData.awb_data = {
        number: orderData.data.data.awb_data.awb as string,
        last_activity: trackData.data.tracking_data.shipment_track_activities[0]
          .activity as string,
        last_scan_location: trackData.data.tracking_data
          .shipment_track_activities[0].location as string,
        last_scan_time: trackData.data.tracking_data
          .shipment_track_activities[0].date as string,
        tracking_url: trackData.data.tracking_data.track_url as string,
      };
    }

    return JSON.stringify(orderTrackData);
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return (
      msg ??
      "I couldn't find any data for the tracking ID you provided. Please double-check the ID and try again."
    );
  }
};

export const calculateRTOPerformance = async (
  args: {
    start_date: string;
    end_date: string;
  },
  srToken: string
) => {
  if (!moment(args.end_date, "YYYY-MMM-DD").isValid()) {
    args.end_date = moment().format("YYYY-MMM-DD");
  }

  if (!moment(args.start_date, "YYYY-MMM-DD").isValid()) {
    args.start_date = moment().subtract(30, "days").format("YYYY-MMM-DD");
  }

  const url = `${API_DOMAINS.SR_DASHBOARD}/api/2.0/rto/chart-wise-data?courier=&courier_mode=&end_date=${args.end_date}&is_web=0&payment_method=&start_date=${args.start_date}&zones=`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    return JSON.stringify({
      data: data.data.info,
      url: `${SR_APP_DOMAIN}/seller/domestic-dashboard/rto`,
    } as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return (
      msg ??
      "It appears that there is no RTO performance data available for the duration you provided."
    );
  }
};

export const calulateCODRemittance = async (
  args: {
    start_date: string;
    end_date: string;
  },
  srToken: string
) => {
  if (!moment(args.end_date, "YYYY-MMM-DD").isValid()) {
    args.end_date = moment().format("YYYY-MMM-DD");
  }

  if (!moment(args.start_date, "YYYY-MMM-DD").isValid()) {
    args.start_date = moment().subtract(30, "days").format("YYYY-MMM-DD");
  }

  const url = `${API_DOMAINS.SHIPROCKET}/v1/account/details/remittance_summary?from=${args.start_date}&is_web=1&to=${args.end_date}`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const codRemittanceData = data.cod_payble;

    return JSON.stringify({
      cod_to_be_remitted: codRemittanceData.cod_payble,
      last_cod_remitted: codRemittanceData.last_cod_remitted,
      total_cod_remitted: codRemittanceData.total_COD_remitted,
      total_adjustment_amount: codRemittanceData.total_adjustment_amount,
      remittance_initiated: codRemittanceData.in_process,
      url: `${SR_APP_DOMAIN}/remittance-logs`,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "No data found";
  }
};

export const shippingRateCalculator = async (
  args: {
    pickup_postcode: string;
    delivery_postcode: string;
    weight_in_kg: number;
    payment_type: string;
    shipment_value: number;
  },
  srToken: string
) => {
  const url = `${
    API_DOMAINS.SERVICEABILITY
  }/courier/ratingserviceability?medium=shiprocketMCP&pickup_postcode=${
    args.pickup_postcode
  }&delivery_postcode=${args.delivery_postcode}&weight=${
    args.weight_in_kg
  }&cod=${args.payment_type === "COD" ? 1 : 0}&declared_value=${
    args.shipment_value
  }`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const couriers = data.data.available_courier_companies.map(
      (courier: Record<string, unknown>) => ({
        courier_id: courier.courier_company_id,
        courier_name: courier.courier_name,
        cutoff_time: courier.cutoff_time,
        etd: courier.etd,
        freight_charge: courier.freight_charge,
        transport_mode: courier.is_surface ? "SURFACE" : "AIR",
        rto_charges: courier.rto_charges,
      })
    );

    return JSON.stringify({
      inputs: args,
      data: couriers,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to fetch couriers due to some error";
  }
};

export const fetchShipmentSummary = async (
  args: Record<string, unknown>,
  srToken: string
) => {
  try {
    const shipmentDetailsPromise = axios.get(
      `${API_DOMAINS.SR_REPORT}/dashboard/details`,
      {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const avgShippingCostPromise = axios.get(
      `${API_DOMAINS.SR_DASHBOARD}/api/getavgshippingcost`,
      {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responses = await Promise.allSettled([
      shipmentDetailsPromise,
      avgShippingCostPromise,
    ]);

    const data = responses.map((response) => {
      if (response.status === "fulfilled" && "data" in response.value.data) {
        return response.value.data.data;
      } else {
        if (response.status === "rejected") {
          throw response.reason;
        }
      }
    });

    return JSON.stringify({
      timeline: "Last 30 days",
      data: {
        total_shipments:
          data?.[0]?.shipment_details?.[0]?.total_shipments ?? "No data found",
        pickup_pending:
          data?.[0]?.shipment_details?.[0]?.pickup_pending ?? "No data found",
        in_transit:
          data?.[0]?.shipment_details?.[0]?.in_transit ?? "No data found",
        delivered:
          data?.[0]?.shipment_details?.[0]?.delivered ?? "No data found",
        ndr_pending:
          data?.[0]?.shipment_details?.[0]?.undelivered ?? "No data found",
        rto_shipments: data?.[0]?.shipment_details?.[0]?.rto ?? "No data found",
        avg_shipping_cost:
          typeof data?.[1]?.[0]?.count === "number"
            ? `₹${data?.[1]?.[0]?.count}`
            : "No data found",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "No data found";
  }
};

export const fetchOrders = async (
  args: { status: string },
  srToken: string
) => {
  let concatenatedStatusIds = "";

  switch (args.status) {
    case "NEW": {
      concatenatedStatusIds = "1";
      break;
    }
    case "CANCELLED": {
      concatenatedStatusIds = "5,18";
      break;
    }
    case "READY_TO_SHIP": {
      concatenatedStatusIds = "34,14,35,12,13,3,4";
      break;
    }
    case "IN_TRANSIT": {
      concatenatedStatusIds = "37,20,44,19,51,43,6";
      break;
    }
    case "DELIVERED": {
      concatenatedStatusIds = "7";
      break;
    }
    case "RTO": {
      concatenatedStatusIds = "15,55,46,45,16,17,36,87,85";
      break;
    }
  }

  const url = `${API_DOMAINS.SHIPROCKET}/v1/orders?medium=shiprocketMCP${
    args.status ? `&filter=${concatenatedStatusIds}&filter_by=status` : ""
  }`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const structuredOrders = data?.data?.map(
      (order: Record<string, unknown>) => ({
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
      })
    );

    return JSON.stringify(structuredOrders);
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to fetch orders due to some error occurred";
  }
};

export const shipOrder = async (
  args: {
    order_id: string;
    // courier_id?: number;
  },
  srToken: string
) => {
  args.order_id = args.order_id.trim();

  const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.order_id}`;
  const shipOrderUrl = `${API_DOMAINS.SHIPROCKET}/v1/courier/assign/awb`;

  try {
    const orderDetails = (
      await axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const srOrderId = orderDetails.data.id as number;

    // if (args.courier_id) {
    const data = (
      await axios.post(
        shipOrderUrl,
        {
          oid: srOrderId,
          // courier_id: args.courier_id,
          medium: "shiprocketMCP",
        },
        {
          headers: {
            Authorization: `Bearer ${srToken}`,
            "Content-Type": "application/json",
          },
        }
      )
    ).data;

    if (typeof data?.response?.data === "string") {
      return JSON.stringify({
        success: false,
        message: data?.response?.data,
      });
    }

    return JSON.stringify({
      success: true,
      courier_name: data?.response?.data?.courier_name,
      assigned_awb: data?.response?.data?.awb_code,
      url: `${SR_APP_DOMAIN}/seller/orders/details/${srOrderId}}`,
    });
    // }

    // const couriersData = (
    //   await axios.get(
    //     `${API_DOMAINS.SERVICEABILITY}/courier/serviceability?order_id=${srOrderId}`,
    //     {
    //       headers: {
    //         Authorization: `Bearer ${srToken}`,
    //         "Content-Type": "application/json",
    //       },
    //     }
    //   )
    // ).data;

    // const couriers =
    //   couriersData?.data?.available_courier_companies
    //     ?.slice(0, 10)
    //     ?.map((courier: Record<string, unknown>) => ({
    //       courier_id: courier.courier_company_id,
    //       courier_name_with_id: `${courier.courier_name} (ID: ${courier.courier_company_id})`,
    //       shipping_cost: courier.rate,
    //       courier_rating: courier.rating,
    //       etd: courier.etd,
    //     })) ?? [];

    // if (couriers.length === 0) {
    //   return JSON.stringify({
    //     success: false,
    //     message: "No available couriers found for this particular order ID",
    //   });
    // }

    // return JSON.stringify({
    //   message: "Please select any courier from the couriers list provided",
    //   couriers,
    // });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to assign courier due to some error occurred";
  }
};

export const orderSchedulePickup = async (
  args: { order_id: string; pickup_date: string },
  srToken: string
) => {
  args.order_id = args.order_id.trim();
  const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.order_id}`;
  const pickupGenerateUrl = `${API_DOMAINS.SHIPROCKET}/v1/courier/generate/pickup`;

  try {
    const orderDetails = (
      await axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const srOrderId = orderDetails.data.id as number;

    const pickupData = (
      await axios.post(
        pickupGenerateUrl,
        {
          oid: srOrderId,
          pickup_date: [args.pickup_date],
          medium: "shiprocketMCP",
        },
        {
          headers: {
            Authorization: `Bearer ${srToken}`,
            "Content-Type": "application/json",
          },
        }
      )
    ).data;

    if (pickupData?.Status === false) {
      return JSON.stringify({
        success: false,
        message: pickupData?.Message,
      });
    }

    return JSON.stringify({
      success: true,
      pickup_scheduled_date: pickupData?.response?.pickup_scheduled_date,
      url: `${SR_APP_DOMAIN}/seller/orders/details/${orderDetails.data.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to schedule your pickup due to some error occurred";
  }
};

export const orderCreate = async (
  args: {
    pickup_location: string;
    customer_name: string;
    customer_email: string;
    customer_phone: number;
    delivery_address: string;
    delivery_city: string;
    delivery_pincode: number;
    delivery_state: string;
    delivery_country: string;
    length: number;
    breadth: number;
    height: number;
    weight: number;
    mode_of_payment: string;
    order_items: {
      name: string;
      sku: string;
      units: number;
      selling_price: number;
    }[];
  },
  srToken: string
) => {
  const url = `${API_DOMAINS.SHIPROCKET}/v1/external/orders/create/adhoc`;

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
          medium: "shiprocketMCP",
        },
        {
          headers: {
            Authorization: `Bearer ${srToken}`,
            "Content-Type": "application/json",
          },
        }
      )
    ).data;

    return JSON.stringify({
      success: true,
      message: `Order created successfully with Order Id: ${data.order_id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to create your order due to some error occurred";
  }
};

export const orderEdit = async (
  args: {
    order_id: string;
    length: number;
    breadth: number;
    height: number;
    weight: number;
  },
  srToken: string
) => {
  try {
    const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.order_id}`;
    const orderEditUrl = `${API_DOMAINS.SHIPROCKET}/v1/orders/edit`;

    const orderDetails = (
      await axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const srOrderId = orderDetails.data.id as number;

    await axios.post(
      orderEditUrl,
      {
        order_id: srOrderId,
        length: args.length,
        breadth: args.breadth,
        height: args.height,
        weight: args.weight,
        action: ["product_details"],
      },
      {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return JSON.stringify({
      success: true,
      message: `Order updated successfully`,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to edit your order due to some error occurred";
  }
};

export const orderCancel = async (
  args: {
    order_id: number;
    cancel_on_channel: boolean;
  },
  srToken: string
) => {
  const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.order_id}`;
  const orderCancelUrl = `${API_DOMAINS.SHIPROCKET}/v1/orders/cancel`;

  try {
    const orderDetails = (
      await axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const srOrderId = orderDetails.data.id as number;

    await axios.post(
      orderCancelUrl,
      {
        ids: [srOrderId],
        cancel_on_channel: args.cancel_on_channel,
        medium: "shiprocketMCP",
      },
      {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return JSON.stringify({
      success: true,
      message: `Order cancelled successfully. Check details on ${SR_APP_DOMAIN}/seller/orders/details/${srOrderId}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to cancel your order due to some error occurred";
  }
};

export const listPickupAddresses = async (args: unknown, srToken: string) => {
  const url = `${API_DOMAINS.SHIPROCKET}/v1/settings/company/pickup-address?medium=shiprocketMCP`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    return JSON.stringify({
      url: `${SR_APP_DOMAIN}/seller/settings/company-setup/pickup-addresses`,
      pickup_addresses: data?.data?.shipping_address
        ?.slice(0, 10)
        ?.map((address: Record<string, unknown>) => ({
          pickup_address_id: address.id,
          pickup_location_nickname: address.pickup_location,
          address: address.address,
          city: address.city,
          state: address.state,
          country: address.country,
          pincode: address.pin_code,
        })),
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? `Unable to fetch pickup addresses due to some error occurred`;
  }
};

export const generateLabel = async (
  args: { order_id: string },
  srToken: string
) => {
  try {
    const orderDetailUrl = `${API_DOMAINS.SHIPROCKET}/v1/copilot/order/show/${args.order_id}`;
    const orderDetails = (
      await axios.get(orderDetailUrl, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    const generateLableUrl = `${API_DOMAINS.SHIPROCKET}/v1/courier/generate/label`;

    const shipmentId = orderDetails.data.shipments.id as number;

    const data = (
      await axios.post(
        generateLableUrl,
        {
          shipment_id: [shipmentId],
          medium: "shiprocketMCP",
        },
        {
          headers: {
            Authorization: `Bearer ${srToken}`,
            "Content-Type": "application/json",
          },
        }
      )
    ).data;

    return JSON.stringify({
      file_url: data.label_url,
    });
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? `Unable to generate label due to some error occurred`;
  }
};
