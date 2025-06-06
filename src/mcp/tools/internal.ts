import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  calculateRTOPerformance,
  calulateCODRemittance,
  fetchRelevantShiprocketKnowledgebase,
  fetchShipmentSummary,
  shippingRateCalculator,
  trackOrderByAWB,
} from "@/mcp/api_calls/internal";
import { toolWrapper } from "@/mcp/tools/utils";
import { z as zod } from "zod";
import moment from "moment";

export const initializeTools = (server: McpServer) => {
  server.tool(
    "shiprocket_knowledgebase",
    `Search for information about queries related to logistics, shipment, Shiprocket, it's dashboard or app. For any such queries, you must use this tool!
    
    Args:
        query: String representing contextualized query which needs to be searched in knowledgebase
    
    Returns: String representing relevant knowledgebase`,
    {
      query: zod.string(),
    },
    (args, context) =>
      toolWrapper(fetchRelevantShiprocketKnowledgebase)(
        { query: args.query, source: context._meta?.source },
        context
      )
  );

  server.tool(
    "order_tracking",
    `Calculate data for the order tracking status using (order id)/(AWB id)/(Channel order id) as tracking ID. For query related to order tracking/status, you must use this tool! Ask for (order id)/(AWB id)/(Channel order id) if order id is not provided
    
    Args:
        track_id: String representing alphanumeric tracking ID which can be (order id)/(AWB id)/(Channel order id).
    
    Returns: Dictionary containing following info:
        order_id: String representing order id
        created_on: Timestamp formatted string representing order creation date-time
        order_status: String representing status of order
        awb_data: Optional dictionary containing following AWB information of order:
          number: String representing AWB number
          last_activity: String representing last marked activity of order
          last_scan_location: String representing last marked location of order
          last_scan_time: Timestamp formatted string representing last order scan timestamp
          tracking_url: String representing URL of order tracking page`,
    {
      track_id: zod.string(),
    },
    toolWrapper(trackOrderByAWB)
  );

  server.tool(
    "rto_performance_tool",
    `Calculate data for the RTO (Retrun To Origin) performance for provided start date and end date.
Call rto_performance_tool tool ONLY and ONLY when user asking for "RTO Performance" and nothing else.
Delivery performance is not RTO perfromance
Show data in tabular format.

    Args:
        start_date: String representing starting date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take start date as (current_date - 30 days). current_date = ${moment().format(
          "YYYY-MMM-DD"
        )}
        end_date: End date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take end date as current_date. current_date = ${moment().format(
          "YYYY-MMM-DD"
        )}

    
    Returns: Dictionary containing duration wise RTO performance`,
    {
      start_date: zod.string(),
      end_date: zod.string(),
    },
    toolWrapper(calculateRTOPerformance)
  );

  server.tool(
    "cod_remittance_tool",
    `Calculate data for the COD Remittance for provided start date and end date.
Call 'cod_remittance_tool' tool ONLY and ONLY when user asking for "COD Remittance" and nothing else.
Don't call this tool incase for prepaid

    Args:
        start_date: String representing starting date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take start date as (current_date - 30 days). current_date = ${moment().format(
          "YYYY-MMM-DD"
        )}
        end_date: End date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take end date as current_date. current_date = ${moment().format(
          "YYYY-MMM-DD"
        )}

    
    Returns: Dictionary containing following info:
        cod_to_be_remitted: Amount (INR) representing COD to be remitted
        last_cod_remitted: Amount (INR) representing COD last remitted
        total_cod_remitted: Amount (INR) representing total COD remitted
        total_adjustment_amount: Amount (INR) representing total deduction from COD
        remittance_initiated: Amount (INR) for which remittance is initiated`,
    {
      start_date: zod.string(),
      end_date: zod.string(),
    },
    toolWrapper(calulateCODRemittance)
  );

  server.tool(
    "shipping_rate_calculator",
    `Get serviceable shipping couriers, their prices and EDDs (Estimated Delivery Dates).
    
    Args:
        pickup_postcode: String representing pincode of order pickup location
        delivery_postcode: String representing pincode of order delivery location
        weight_in_kg: Number representing weight of the order package. If not provided take default as 1kg
        payment_type: Enum('COD', 'PREPAID') representing mode of payment of the order. If not provided take default as COD
        shipment_value: Number representing value (INR) of order to ship. If not provided take default as 1000
    
    Returns: List of dictionary containing following info about couriers:
        courier_id: Number representing id of the courier
        courier_name: String representing name of the courier
        cutoff_time: String representing time deadline for 
        etd: Date-time formatted string representing expected date & time of delivery
        freight_charge: Number represeting cost of shipment in Indian Rupees
        transport_mode: Enum('SURFACE', 'AIR') representing mode of transport
        rto_charges: Number represeting the cost (in Indian Rupees) associated with return shipment if order gets RTO`,
    {
      pickup_postcode: zod
        .string()
        .regex(
          /^[1-9][0-9]{5}$/,
          "Invalid pincode. Pincode should be a 6-digit number."
        ),
      delivery_postcode: zod
        .string()
        .regex(
          /^[1-9][0-9]{5}$/,
          "Invalid pincode. Pincode should be a 6-digit number."
        ),
      weight_in_kg: zod.number(),
      payment_type: zod.enum(["COD", "PREPAID"]),
    },
    toolWrapper(shippingRateCalculator)
  );

  server.tool(
    "shipment_summary_tool",
    `This tool provides summary about shipment performance of last 30 days:

    Returns: Dictionary containing following info about couriers:
        total_shipments: Number representing total shipments
        pickup_pending: Number representing total pending shipments
        in_transit: Number representing total shipments in-transit
        delivered: Number representing total delivered shipments
        ndr_pending: Number representing total NDR pending shipments
        rto_shipments: Number representing total shipments which got RTO
        avg_shipping_cost: Number representing average cost spent on shipments`,
    {},
    toolWrapper(fetchShipmentSummary)
  );
};
