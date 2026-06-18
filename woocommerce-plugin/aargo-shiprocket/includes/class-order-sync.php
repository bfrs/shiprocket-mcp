<?php
/**
 * Order Sync - WooCommerce to Shiprocket synchronization
 */

class Aargo_Shiprocket_Order_Sync {
    
    public function __construct() {
        // Auto-sync on order status change
        add_action('woocommerce_order_status_processing', array($this, 'sync_order_to_shiprocket'));
        
        // Manual sync button
        add_action('wp_ajax_aargo_sync_order', array($this, 'ajax_sync_order'));
        
        // Auto-ship if enabled
        add_action('aargo_order_synced', array($this, 'maybe_auto_ship'), 10, 2);
        
        // Add order meta on checkout
        add_action('woocommerce_checkout_order_created', array($this, 'add_order_meta'));
    }
    
    /**
     * Sync order to Shiprocket
     */
    public function sync_order_to_shiprocket($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) {
            return;
        }
        
        // Check if already synced
        $sr_order_id = $order->get_meta('_shiprocket_order_id');
        if ($sr_order_id) {
            return;
        }
        
        $client = new Aargo_Shiprocket_MCP_Client();
        
        // Check health
        if (!$client->health_check()) {
            $order->add_order_note('Shiprocket MCP server unreachable');
            return;
        }
        
        // Build Shiprocket payload
        $payload = $this->build_order_payload($order);
        
        // Create order in Shiprocket
        $result = $client->create_order($payload);
        
        if ($result['success']) {
            $data = $result['data'];
            
            // Store Shiprocket data
            $order->update_meta_data('_shiprocket_order_id', $data['order_id']);
            $order->update_meta_data('_shiprocket_status', 'created');
            $order->add_order_note('Synced to Shiprocket: Order #' . $data['order_id']);
            $order->save();
            
            // Trigger auto-ship hook
            do_action('aargo_order_synced', $order_id, $data['order_id']);
            
            // Log success
            $this->log_sync($order_id, $data['order_id'], 'success');
        } else {
            $order->add_order_note('Shiprocket sync failed: ' . $result['error']);
            $order->save();
            
            $this->log_sync($order_id, null, 'failed', $result['error']);
        }
    }
    
    /**
     * Build order payload for Shiprocket
     */
    private function build_order_payload($order) {
        $items = array();
        
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if (!$product) {
                continue;
            }
            
            $items[] = array(
                'name' => $product->get_name(),
                'sku' => $product->get_sku() ?: 'SKU-' . $product->get_id(),
                'units' => $item->get_quantity(),
                'selling_price' => $item->get_subtotal() / $item->get_quantity(),
                'discount' => $item->get_subtotal() - $item->get_total(),
            );
        }
        
        // Get pickup address (first one)
        $client = new Aargo_Shiprocket_MCP_Client();
        $pickup_result = $client->list_pickup_addresses();
        $pickup_address = 'default';
        
        if ($pickup_result['success'] && !empty($pickup_result['data'])) {
            $pickup_address = $pickup_result['data'][0]['pickup_location'] ?? 'default';
        }
        
        // Calculate total weight
        $weight = $this->calculate_order_weight($order);
        
        // Get dimensions from settings or defaults
        $dimensions = get_option('aargo_sr_default_dimensions', array(
            'length' => 10,
            'breadth' => 10,
            'height' => 10
        ));
        
        return array(
            'order_id' => $order->get_order_number(),
            'order_date' => $order->get_date_created()->format('Y-m-d H:i:s'),
            'pickup_location' => $pickup_address,
            'billing_customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'billing_last_name' => $order->get_billing_last_name(),
            'billing_address' => $order->get_billing_address_1(),
            'billing_address_2' => $order->get_billing_address_2(),
            'billing_city' => $order->get_billing_city(),
            'billing_pincode' => $order->get_billing_postcode(),
            'billing_state' => $order->get_billing_state(),
            'billing_country' => $order->get_billing_country(),
            'billing_email' => $order->get_billing_email(),
            'billing_phone' => $order->get_billing_phone(),
            'shipping_is_billing' => true,
            'order_items' => $items,
            'payment_method' => $order->get_payment_method() === 'cod' ? 'COD' : 'Prepaid',
            'shipping_charges' => (float) $order->get_shipping_total(),
            'giftwrap_charges' => 0,
            'transaction_charges' => 0,
            'total_discount' => (float) $order->get_discount_total(),
            'sub_total' => (float) $order->get_subtotal(),
            'length' => $dimensions['length'],
            'breadth' => $dimensions['breadth'],
            'height' => $dimensions['height'],
            'weight' => $weight,
        );
    }
    
    /**
     * Calculate total order weight
     */
    private function calculate_order_weight($order) {
        $total_weight = 0;
        
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if ($product) {
                $product_weight = (float) $product->get_weight();
                $total_weight += ($product_weight * $item->get_quantity());
            }
        }
        
        // Default to 0.5kg if no weight set
        return $total_weight > 0 ? $total_weight : 0.5;
    }
    
    /**
     * Auto-ship order if enabled
     */
    public function maybe_auto_ship($order_id, $sr_order_id) {
        if (get_option('aargo_sr_auto_ship', 'no') !== 'yes') {
            return;
        }
        
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $client = new Aargo_Shiprocket_MCP_Client();
        
        // Get best courier
        $pickup_postcode = get_option('aargo_sr_pickup_postcode', '110001');
        $delivery_postcode = $order->get_billing_postcode();
        $weight = $this->calculate_order_weight($order);
        $cod_or_prepaid = $order->get_payment_method() === 'cod' ? 'COD' : 'PREPAID';
        
        $rates = $client->get_rates($pickup_postcode, $delivery_postcode, $weight, $cod_or_prepaid);
        
        if (!$rates['success'] || empty($rates['data'])) {
            $order->add_order_note('Auto-ship failed: No couriers available');
            $order->save();
            return;
        }
        
        // Select cheapest courier
        $best_courier = $rates['data'][0];
        $courier_id = $best_courier['courier_id'] ?? null;
        
        // Ship order
        $ship_result = $client->ship_order($sr_order_id, $courier_id);
        
        if ($ship_result['success']) {
            $data = $ship_result['data'];
            
            $order->update_meta_data('_awb_number', $data['awb']);
            $order->update_meta_data('_courier_name', $courier_name);
            $order->update_meta_data('_shiprocket_status', 'shipped');
            $order->update_meta_data('_shipment_id', $data['shipment_id']);
            $order->add_order_note('Auto-shipped via ' . $courier_name . '. AWB: ' . $data['awb']);
            $order->save();
            
            // Generate label
            $this->generate_label($order_id, $data['shipment_id']);
        } else {
            $order->add_order_note('Auto-ship failed: ' . $ship_result['error']);
            $order->save();
        }
    }
    
    /**
     * Generate shipping label
     */
    private function generate_label($order_id, $shipment_id) {
        $order = wc_get_order($order_id);
        $client = new Aargo_Shiprocket_MCP_Client();
        
        $result = $client->generate_label($shipment_id);
        
        if ($result['success']) {
            $order->update_meta_data('_label_url', $result['data']['label_url']);
            $order->add_order_note('Label generated: ' . $result['data']['label_url']);
            $order->save();
        }
    }
    
    /**
     * AJAX sync order
     */
    public function ajax_sync_order() {
        check_ajax_referer('aargo_sr_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permission denied');
        }
        
        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        
        if (!$order_id) {
            wp_send_json_error('Invalid order ID');
        }
        
        $this->sync_order_to_shiprocket($order_id);
        
        wp_send_json_success('Order synced');
    }
    
    /**
     * Add order meta on checkout
     */
    public function add_order_meta($order) {
        // Store order source
        $order->update_meta_data('_aargo_source', 'woocommerce');
        $order->save();
    }
    
    /**
     * Log sync operation
     */
    private function log_sync($wc_order_id, $sr_order_id, $status, $error = null) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_sync';
        
        $wpdb->insert($table, array(
            'wc_order_id' => $wc_order_id,
            'shiprocket_order_id' => $sr_order_id,
            'status' => $status,
            'error_message' => $error,
            'created_at' => current_time('mysql')
        ));
    }
}
