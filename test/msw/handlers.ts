import { http, HttpResponse } from "msw";
import { API_DOMAINS } from "@/config";

export const handlers = [
  // Auth
  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/auth/login`,
    () => {
      return HttpResponse.json({
        token: "mock-seller-token-12345",
      });
    }
  ),

  // Orders
  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders`,
    () => {
      return HttpResponse.json({
        data: [
          {
            id: 12345,
            channel_order_id: "ORDER-001",
            status: "READY_TO_SHIP",
          },
        ],
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/create/adhoc`,
    () => {
      return HttpResponse.json({
        order_id: "ORDER-002",
        shipment_id: 67890,
        status: "NEW",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/cancel`,
    () => {
      return HttpResponse.json({
        status: true,
        message: "Order cancelled successfully",
      });
    }
  ),

  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/show/:id`,
    () => {
      return HttpResponse.json({
        data: {
          id: 12345,
          order_id: "ORDER-001",
          status: "READY_TO_SHIP",
        },
      });
    }
  ),

  // Tracking
  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/courier/track/awb/:awb`,
    () => {
      return HttpResponse.json({
        tracking_data: {
          track_status: 1,
          shipment_status: 7,
          shipment_track: [
            {
              id: 1,
              awb_code: "AWB123456",
              courier_name: "Delhivery",
              status: "Out for Delivery",
            },
          ],
        },
      });
    }
  ),

  // Shipping
  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/courier/assign/awb`,
    () => {
      return HttpResponse.json({
        response: {
          data: {
            awb_code: "AWB123456",
            courier_company_id: 1,
            courier_name: "Delhivery",
          },
        },
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/courier/generate/pickup`,
    () => {
      return HttpResponse.json({
        pickup_scheduled_date: "2024-01-15",
        pickup_token_number: "PKP123",
        status: 1,
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/courier/generate/label`,
    () => {
      return HttpResponse.json({
        label_url: "https://example.com/label.pdf",
      });
    }
  ),

  // Settings
  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/settings/company/pickup`,
    () => {
      return HttpResponse.json({
        data: {
          shipping_address: [
            {
              pin_code: "110092",
              city: "Delhi",
              state: "Delhi",
            },
          ],
        },
      });
    }
  ),

  // Serviceability
  http.get(
    `${API_DOMAINS.SERVICEABILITY}/courier/ratingserviceability`,
    () => {
      return HttpResponse.json({
        data: {
          available_courier_companies: [
            {
              id: 1,
              courier_name: "Delhivery",
              etd: "2024-01-15",
              rate: 120,
            },
          ],
        },
      });
    }
  ),

  // NDR
  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/ndr/all`,
    () => {
      return HttpResponse.json({
        data: [
          {
            id: 1,
            awb_code: "AWB123",
            status: "NDR",
          },
        ],
      });
    }
  ),

  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/ndr/:awb`,
    () => {
      return HttpResponse.json({
        data: {
          id: 1,
          awb_code: "AWB123",
          status: "NDR",
        },
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/ndr/reattempt`,
    () => {
      return HttpResponse.json({
        status: "success",
        message: "Reattempt scheduled",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/ndr/rto`,
    () => {
      return HttpResponse.json({
        status: "success",
        message: "RTO marked",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/ndr/contact-buyer`,
    () => {
      return HttpResponse.json({
        status: "success",
        message: "Buyer contacted",
      });
    }
  ),

  // Returns
  http.get(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/processing/return`,
    () => {
      return HttpResponse.json({
        data: [
          {
            return_id: 1,
            order_id: "ORDER-001",
            status: "PENDING",
          },
        ],
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/create/return`,
    () => {
      return HttpResponse.json({
        return_id: 2,
        order_id: "ORDER-001",
        status: "NEW",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/returns/exchange`,
    () => {
      return HttpResponse.json({
        return_id: 3,
        order_id: "ORDER-001",
        status: "NEW",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/returns/update`,
    () => {
      return HttpResponse.json({
        return_id: 1,
        status: "UPDATED",
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/returns/cancel`,
    () => {
      return HttpResponse.json({
        status: "success",
        message: "Return cancelled",
      });
    }
  ),

  // Manifest
  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/manifests/generate`,
    () => {
      return HttpResponse.json({
        message: "Manifest generated",
        check_ids: [1, 2],
      });
    }
  ),

  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/manifests/print`,
    () => {
      return HttpResponse.json({
        manifest_url: "https://example.com/manifest.pdf",
      });
    }
  ),

  // Invoice
  http.post(
    `${API_DOMAINS.SHIPROCKET}/v1/external/orders/print/invoice`,
    () => {
      return HttpResponse.json({
        invoice_url: "https://example.com/invoice.pdf",
        order_ids: [1],
      });
    }
  ),
];
