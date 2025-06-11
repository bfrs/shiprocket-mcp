import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ApiCalls from "@/mcp/api_calls/internal";
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
      toolWrapper(ApiCalls.fetchRelevantShiprocketKnowledgebase)(
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
        shipment_id: Number representing shipment ID
        awb_data: Optional dictionary containing following AWB information of order:
          number: String representing AWB number
          last_activity: String representing last marked activity of order
          last_scan_location: String representing last marked location of order
          last_scan_time: Timestamp formatted string representing last order scan timestamp
          tracking_url: String representing URL of order tracking page`,
    {
      track_id: zod.string(),
    },
    toolWrapper(ApiCalls.trackOrderByAWB)
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
    toolWrapper(ApiCalls.calculateRTOPerformance)
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
    toolWrapper(ApiCalls.calulateCODRemittance)
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
    toolWrapper(ApiCalls.shippingRateCalculator)
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
    toolWrapper(ApiCalls.fetchShipmentSummary)
  );

  server.tool(
    "order_list",
    `Get list of orders
    
    Args:
        status: Optional ENUM('NEW', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED') representing status filter for orders
        
    Return: List of dictionary containing following info:
        order_id: Number representing order id
        channel_name:  String representing channel name from which order created
        channel_order_id: String representing channel order id
        customer_name: String representing name of who customer placed order
        order_total_cost: Number representing order's total cost (INR)
        status: String representing current status of order
        order_created_at: Timestamp formatted string representing order creation timestamp
        products: List of dictionary containing following info about each product in the order:
            name: String representing product name
            product_sku: String representing product SKU
            quantity: Number representing product quantity
        shipment_id: Number representing shipment id
        shipping_courier_name: String representing shipping courier name
        awb_number: String representing AWB number of order
        payment_mode: String representing mode of payment for order`,
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
    toolWrapper(ApiCalls.fetchOrders)
  );

  server.tool(
    "order_ship",
    `Ship order by assigning courier to the order

    Args:
        order_id: Alphanumeric ID which can be 'Order ID' or 'Channel Order ID' or 'Shipment ID'
        courier_id: Optional number representing courier ID to assign shipment
        
    Returns: Dictionary containing success status and a status message`,
    {
      order_id: zod.string().min(1),
      courier_id: zod.number().optional(),
    },
    toolWrapper(ApiCalls.shipOrder)
  );

  server.tool(
    "order_schedule_pickup",
    `Schedule pickup for the order shipment

    Args:
        order_id: Alphanumeric ID which can be 'Order ID' or 'Channel Order ID' or 'Shipment ID'
        pickup_date: Date formatted ('YYYY-MM-DD') string representing date on which pickup will be scheduled

    Returns: Dictionary containing success status and a status message`,
    {
      order_id: zod.string().min(1),
      pickup_date: zod.string(),
    },
    toolWrapper(ApiCalls.orderSchedulePickup)
  );

  server.tool(
    `order_create`,
    `Create order

    Args:
        pickup_location: String representing short nickname of pickup location
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
    toolWrapper(ApiCalls.orderCreate)
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
    toolWrapper(ApiCalls.orderCancel)
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
    toolWrapper(ApiCalls.listPickupAddresses)
  );

  server.tool(
    "generate_shipment_label",
    `Generate shipment label and get the link of generated label as PDF file

    Returns:
        file_url: String representing URL of generated label`,
    { shipment_id: zod.number() },
    toolWrapper(ApiCalls.generateLabel)
  );
};
