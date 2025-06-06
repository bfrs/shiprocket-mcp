import axios from "axios";
import { handleAxiosAPIErrorLogging } from "./utils";
import moment from "moment";
import { API_DOMAINS } from "@/config";
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

  const url = `${API_DOMAINS.SR_DAHBOARD}/api/2.0/rto/chart-wise-data?courier=&courier_mode=&end_date=${args.end_date}&is_web=0&payment_method=&start_date=${args.start_date}&zones=`;

  try {
    const data = (
      await axios.get(url, {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      })
    ).data;

    return JSON.stringify(data.data.info as Record<string, unknown>);
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
        courier_name: courier.courier_company,
        cutoff_time: courier.cutoff_time,
        etd: courier.etd,
        freight_charge: courier.freight_charge,
        transport_mode: courier.is_surface ? "SURFACE" : "AIR",
        rto_charges: courier.rto_charges,
      })
    );

    return JSON.stringify(couriers);
  } catch (err) {
    const msg = err instanceof Error ? handleAxiosAPIErrorLogging(err) : null;
    return msg ?? "Unable to fetch couriers due to some error";
  }
};

export const fetchShipmentSummary = async (srToken: string) => {
  try {
    const shipmentDetailsPromise = axios.get(
      `${API_DOMAINS.SR_DAHBOARD}/api/2.0/shipment/details`,
      {
        headers: {
          Authorization: `Bearer ${srToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const avgShippingCostPromise = axios.get(
      `${API_DOMAINS.SR_DAHBOARD}/api/getavgshippingcost`,
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
        return null;
      }
    });

    return JSON.stringify({
      timeline: "Last 30 days",
      data: {
        total_shipments:
          data?.[0]?.shipping_data?.total_orders ?? "No data found",
        pickup_pending:
          data?.[0]?.shipping_data?.pqueueschedule ?? "No data found",
        in_transit:
          typeof data?.[0]?.shipping_data?.intrans === "number" &&
          typeof data?.[0]?.shipping_data?.ofd === "number"
            ? data?.[0]?.shipping_data?.intrans + data?.[0]?.shipping_data?.ofd
            : "No data found",
        delivered: data?.[0]?.shipping_data?.delivered ?? "No data found",
        ndr_pending: data?.[0]?.shipping_data?.undelivered ?? "No data found",
        rto_shipments: data?.[0]?.shipping_data?.rto ?? "No data found",
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
