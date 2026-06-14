export interface AuthResponse {
  token: string;
}

export interface ApiErrorResponse {
  success: boolean;
  error: string | Record<string, unknown>;
}

export interface OrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  hsn?: string;
}

export interface Address {
  address: string;
  address_2?: string;
  city: string;
  state: string;
  country: string;
  pincode: number;
  email?: string;
  phone?: number;
}

export interface Order {
  id: number;
  order_id: string;
  order_date: string;
  channel_id: number;
  status: string;
  awb_code?: string;
  courier_name?: string;
  tracking_url?: string;
  shipment_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  order_items?: OrderItem[];
  payment_method?: string;
  sub_total?: number;
  total?: number;
  shipping_charges?: number;
  cod_charges?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CourierCompany {
  id: number;
  courier_name: string;
  etd: string;
  rate?: number;
  courier_company_id?: number;
  cutoff_time?: string;
  freight_charge?: number;
  is_surface?: boolean;
  rto_charges?: number;
}

export interface ServiceabilityResponse {
  data: {
    available_courier_companies: CourierCompany[];
  };
}

export interface TrackingData {
  track_status: number;
  shipment_status: number;
  shipment_track: Array<{
    id: number;
    awb_code: string;
    courier_name: string;
    status: string;
    current_status?: string;
    location?: string;
    date?: string;
  }>;
  shipment_track_activities?: Array<{
    date: string;
    status: string;
    activity: string;
    location: string;
  }>;
  track_url?: string;
}

export interface NdrShipment {
  id: number;
  shipment_id: number;
  channel_order_id: string;
  awb_code: string;
  status: string;
  reason: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  attempts?: number;
}

export interface ReturnOrder {
  return_id: number;
  order_id: string;
  status: string;
  awb_code?: string;
  courier_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ManifestResponse {
  message: string;
  check_ids: number[];
}

export interface InvoiceResponse {
  invoice_url: string;
  order_ids: number[];
}
