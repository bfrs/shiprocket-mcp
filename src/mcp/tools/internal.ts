import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ApiCalls from "@/mcp/api_calls/internal";
import { toolWrapper } from "@/mcp/tools/utils";
import { z as zod } from "zod";
import moment from "moment";

export const initializeTools = (server: McpServer) => {
  server.tool(
    "shiprocket_knowledgebase",
    `<use_case>
    Search for information about queries related to logistics, shipment, Shiprocket, it's dashboard or app. For any such queries, you must use this tool!
</use_case>

<parameters>
    <query type="string"> Contextualized query which needs to be searched in knowledgebase </query>
</parameters>

<return_data type="string">
    Relevant knowledgebase according to provided query
</return_data>`,
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
    `<use_case>
    Calculate data for the order tracking status using (order id)/(AWB id)/(Channel order id) as tracking ID. For query related to order tracking/status, you must use this tool! Ask for (order id)/(AWB id)/(Channel order id) if order id is not provided
</use_case>

<parameters>
    <track_id type="string"> Alphanumeric tracking ID which can be (shiprocket order id)/(AWB id)/(Channel order id) <track_id>
</parameters>

<return_data>
    <order_id type="string"> Order id </order_id>
    <created_on type="timestamp"> Order creation timestamp <created_on>
    <order_status type="string"> Status of order <order_status>
    <shipment_id type="number"> Shipment ID assigned to order <shipment_id>
    <awb_data optional="true">
        <number type="string"> AWB number </number>
        <last_activity type="string"> Last marked activity of order </last_activity>
        <last_scan_location type="string"> Last marked location of order </last_scan_location>
        <last_scan_time type="timestamp"> Last order scan timestamp </last_scan_time>
        <tracking_url type="string"> URL of order tracking page </tracking_url>
    </awb_data>
</return_data>`,
    {
      track_id: zod.string(),
    },
    toolWrapper(ApiCalls.trackOrderByAWB)
  );

  server.tool(
    "rto_performance_tool",
    `<use_case>
    Calculate data for the RTO (Retrun To Origin) performance for provided start date and end date.
    Call rto_performance_tool tool ONLY and ONLY when user asking for "RTO Performance" and nothing else.
    Delivery performance is not RTO perfromance.
</use_case>

<parameters>
    <start_date type="string"> Starting date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take start date as (current_date - 30 days). current_date = ${moment().format(
      "YYYY-MMM-DD"
    )} </start_date>
    <end_date type="string"> End date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take end date as current_date. current_date = ${moment().format(
      "YYYY-MMM-DD"
    )} </end_date>
</parameters>

<return_data>
    <data type="dictionary"> Dictionary containing duration wise RTO performance </data>
    <url type="string"> URL of RTO Performance page </url>
</return_data>`,
    {
      start_date: zod.string(),
      end_date: zod.string(),
    },
    toolWrapper(ApiCalls.calculateRTOPerformance)
  );

  server.tool(
    "cod_remittance_tool",
    `<use_case>
    Calculate data for the COD Remittance for provided start date and end date.
    Call 'cod_remittance_tool' tool ONLY and ONLY when user asking for "COD Remittance" and nothing else.
    Don't call this tool incase for prepaid
</use_case>

<parameters>
    <start_date type="string"> Starting date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take start date as (current_date - 30 days). current_date = ${moment().format(
      "YYYY-MMM-DD"
    )} </start_date>
    <end_date type="string"> End date for filtering RTO data in the format of YYYY-Mon-dd. In case user provided such as last 30 days, take end date as current_date. current_date = ${moment().format(
      "YYYY-MMM-DD"
    )} </end_date>
</parameters>

<return_data>
    <cod_to_be_remitted type="number"> Amount (INR) representing COD to be remitted </cod_to_be_remitted>
    <last_cod_remitted type="number"> Amount (INR) representing COD last remitted </last_cod_remitted>
    <total_cod_remitted type="number"> Amount (INR) representing total COD remitted </total_cod_remitted>
    <total_adjustment_amount type="number"> Amount (INR) representing total deduction from COD </total_adjustment_amount>
    <remittance_initiated type="number"> Amount (INR) for which remittance is initiated </remittance_initiated>
    <url type="string"> URL of remittance page </url>
</return_data>`,
    {
      start_date: zod.string(),
      end_date: zod.string(),
    },
    toolWrapper(ApiCalls.calulateCODRemittance)
  );

  server.tool(
    "shipping_rate_calculator",
    `<use_case>
    Get serviceable shipping couriers, their prices and EDDs (Estimated Delivery Dates)
</use_case>

<parameters>
    <pickup_postcode type="string"> Pincode of order pickup location (take any pincode if city is provided) </pickup_postcode>
    <delivery_postcode type="string"> String representing pincode of order delivery location (take any pincode if city is provided) </delivery_postcode>
    <weight_in_kg type="number" default="1"> Number representing weight of the order package </weight_in_kg>
    <payment_type type="Enum['COD'|'PREPAID']" default="COD"> Mode of payment of the order </payment_type>
    <shipment_value type="number" default="1000"> Value (INR) of order to ship </shipment_value>
</parameters>

<return_data>
    <courier>
        <courier_id type="number"> Id of the courier </courier_id>
        <courier_name type="string"> Name of the courier </courier_name>
        <cutoff_time type="string"> Cutoff time of courier for same day pickup </cutoff_time>
        <etd type="timestamp"> Expected date & time of delivery </etd>
        <freight_charge type="number"> Cost of shipment in Indian Rupees </freight_charge>
        <transport_mode type="Enum[SURFACE|AIR]"> Mode of transport </transport_mode>
        <rto_charges type="number"> Cost (in INR) associated with return shipment if order gets RTO </rto_charges>
    </courier>
</return_data>`,
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
    `<use_case>
    This tool provides summary about shipment performance of last 30 days
</use_case>

</return_data>
    <total_shipments type="number"> Total shipments </total_shipments>
    <pickup_pending type="number"> Total pending shipments </pickup_pending>
    <in_transit type="number"> Total shipments in-transit </in_transit>
    <delivered type="number"> Total delivered shipments </delivered>
    <ndr_pending type="number"> Total NDR pending shipments </ndr_pending>
    <rto_shipments type="number"> Total shipments which got RTO </rto_shipments>
    <avg_shipping_cost type="number"> Average cost spent on shipments </avg_shipping_cost>
</return_data>`,
    {},
    toolWrapper(ApiCalls.fetchShipmentSummary)
  );

  server.tool(
    "order_list",
    `<use_case>
    Get list of orders
</use_case>

<parameters>
    <status optional="true" type="ENUM[NEW|READY_TO_SHIP|IN_TRANSIT|DELIVERED]"> Status filter for orders </status>
</parameters>

<return_data>
    <order>
        <order_id type="number"> Order id </order_id>
        <channel_name type="string"> Channel name from which order created </channel_name>
        <channel_order_id type="string"> Channel order id </channel_order_id>
        <customer_name type="string"> Name of customer who placed order </customer_name>
        <order_total_cost type="number"> Order's total cost (INR) </order_total_cost>
        <status type="string"> Current status of order </status>
        <order_created_at type="timestamp"> Order creation timestamp </order_created_at>
        <products>
            <product>
                <name type="string"> Product name </name>
                <product_sku type="string"> Product SKU </product_sku>
                <quantity type="number"> Number representing product quantity </quantity>
            </product>
        </products>
        <shipment_id type="number"> Shipment id </shipment_id>
        <shipping_courier_name type="sting"> Shipping courier name </shipping_courier_name>
        <awb_number type="string"> AWB number of order </awb_number>
        <payment_mode type="string"> Mode of payment for order </payment_mode>
    </order>
</return_data>`,
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
    `<use_case>
    Ship order by assigning courier to the order.
</use_case>

<parameters>
    <order_id type="string"> Alphanumeric ID which can be 'Shiprocket Order ID' or 'Channel Order ID' </order_id>
</parameters>
        
<return_data>
    <success type="boolean"> Is response a success or failure </success>,
    <courier_name type="string"> Name of courier assigned </courier_name>
    <assigned_awb type="string"> AWB assigned </assigned_awb>
    <url type="string"> Order detail page URL </url>
</return_data>`,
    {
      order_id: zod.string().min(1),
      // courier_id: zod.number().optional(),
    },
    toolWrapper(ApiCalls.shipOrder)
  );

  server.tool(
    "order_schedule_pickup",
    `<use_case>
    Schedule pickup for the order shipment
</use_case>

<parameters>
    <order_id type="string"> Alphanumeric ID which can be 'Shiprocket Order ID' or 'Channel Order ID' </order_id>
    <pickup_date type="date" format="YYYY-MM-DD"> Date on which pickup will be scheduled </pickup_date>
</parameters>

<return_data>
    <success type="boolean"> Is response a success or failure </success>
    <pickup_scheduled_date type="date"> Date on which pickup is scheduled </courier_name>
    <url type="string"> Order detail page URL </url>
</return_data>`,
    {
      order_id: zod.string().min(1),
      pickup_date: zod.string(),
    },
    toolWrapper(ApiCalls.orderSchedulePickup)
  );

  server.tool(
    "order_edit",
    `<use_case>
      Edit order product's dimensions (lenght, breadth, height) and weight provided by the user. If not provided, ask user to provide.
    </use_case>

    <parameters>
        <order_id type="string"> Alphanumeric ID which can be 'Shiprocket Order ID' or 'Channel Order ID' </order_id>
        <length type="number"> Length of product in centimeters </length>
        <breadth type="number"> Breadth of product in centimeters </breadth>
        <height type="number"> Height of product in centimeters </height>
        <weight type="number"> Weight of product in kilograms </weight>
    </parameters>

    <return_data>
        <success type="boolean"> Is response a success or failure </success>
        <message type="string"> Success or failure message </message>
    </return_data>`,
    {
      order_id: zod.string(),
      length: zod.number(),
      breadth: zod.number(),
      height: zod.number(),
      weight: zod.number(),
    },
    toolWrapper(ApiCalls.orderEdit)
  );

  // server.tool(
  //   `order_create`,
  //   `Create order

  //   Args:
  //       pickup_location: String representing short nickname of pickup location
  //       customer_name: String representing name of the customer who placed order
  //       customer_email: String representing email of the customer who placed order
  //       customer_phone: 10-digit number representing phone number of the customer who placed order
  //       delivery_address: String representing customer address on which order will be delivered
  //       delivery_city: String representing city of delivery address
  //       delivery_pincode: 6-digit number representing pincode of delivery address
  //       delivery_state: String representing state of delivery address
  //       delivery_country: String representing country of delivery address
  //       length:	Number representing length of the order package in centimeters
  //       breadth: Number representing breadth of the order package in centimeters
  //       height:	Number representing height of the order package in centimeters
  //       weight: Number representing wight of the order package in kilograms
  //       mode_of_payment: Enum('COD', 'PREPAID') representing mode of payment for the order
  //       order_items: List of dictionary containing following info of each product in the order:
  //           name: String representing name of the product item
  //           sku: String representing SKU of the product item
  //           units: Number representing quantity of product ordered
  //           selling_price: Number representing price of product ordered

  //   Returns: Dictionary containing success status and a status message`,
  //   {
  //     pickup_location: zod.string(),
  //     customer_name: zod.string(),
  //     customer_email: zod.string().email(),
  //     customer_phone: zod.number(),
  //     delivery_address: zod.string(),
  //     delivery_city: zod.string(),
  //     delivery_pincode: zod.number(),
  //     delivery_state: zod.string(),
  //     delivery_country: zod.string().default("India"),
  //     length: zod.number(),
  //     breadth: zod.number(),
  //     height: zod.number(),
  //     weight: zod.number(),
  //     mode_of_payment: zod.string(zod.enum(["COD", "PREPAID"])),
  //     order_items: zod.array(
  //       zod.object({
  //         name: zod.string(),
  //         sku: zod.string(),
  //         units: zod.number(),
  //         selling_price: zod.number(),
  //       })
  //     ),
  //   },
  //   toolWrapper(ApiCalls.orderCreate)
  // );

  server.tool(
    "order_cancel",
    `<use_case>
    Cancel order
</use_case>

<parameters>
    <order_id type="string"> Alphanumeric ID which can be 'Shiprocket Order ID' or 'Channel Order ID' </order_id>
    <cancel_on_channel type="boolean" optional="true"> If the order should also be cancelled on the original channel </cancel_on_channel>
</parameters>

<return_data>
    <success type="boolean"> Is response a success or failure </success>
    <message type="string"> Message of the action accordingly </message>
</return_data>`,
    {
      order_id: zod.string(),
      cancel_on_channel: zod.boolean().default(true),
    },
    toolWrapper(ApiCalls.orderCancel)
  );

  server.tool(
    "list_pickup_addresses",
    `<use_case>
    Get all the pickup addresses of the seller
</use_case>

<return_data>
    <pickup_addresses>
        <address>
            <pickup_address_id type="number"> Pickup address ID </pickup_address_id>
            <pickup_location_nickname type="string"> Short nickname of pickup location </pickup_location_nickname>
            <address type="string"> Pickup address line </address>
            <city type="string"> Pickup address' city </city>
            <state type="string"> Pickup address' state </state>
            <country type="string"> Pickup address' country </country>
            <pincode type="number"> Pickup address' pincode </pincode>
        </address>
    </pickup_addresses>
    <url type="string"> URL of page containing list of all pickup addresses </url>
</return_data>`,
    {},
    toolWrapper(ApiCalls.listPickupAddresses)
  );

  server.tool(
    "generate_shipment_label",
    `<use_case>
    Generate shipment label and get the link of generated label as PDF file
</use_case>

<parameters>
    <order_id type="string"> Alphanumeric tracking ID which can be (Shiprocket order id)/(AWB id)/(Channel order id) </order_id>
</parameters>

<return_data>
    <file_url type="string">URL of generated label </file_url>
</return_data>`,
    { order_id: zod.string() },
    toolWrapper(ApiCalls.generateLabel)
  );
};
