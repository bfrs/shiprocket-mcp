<?php
/**
 * Webhook - Handle Shiprocket webhook callbacks
 */

class Aargo_Shiprocket_Webhook {
    
    public function __construct() {
        // Register webhook endpoint
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    public function register_routes() {
        register_rest_route('aargo/v1', '/shiprocket-webhook', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_webhook'),
            'permission_callback' => array($this, 'verify_webhook_signature')
        ));
    }
    
    /**
     * Verify webhook signature
     */
    public function verify_webhook_signature($request) {
        $signature = $request->get_header('X-Shiprocket-Signature');
        $webhook_secret = get_option('aargo_sr_webhook_secret', '');
        
        // If no secret is configured, allow for setup phase
        if (empty($webhook_secret)) {
            return true;
        }
        
        // If no signature provided, reject
        if (empty($signature)) {
            return new WP_Error('unauthorized', 'Webhook signature required', array('status' => 401));
        }
        
        // Calculate expected signature
        $payload = $request->get_body();
        $expected = hash_hmac('sha256', $payload, $webhook_secret);
        
        // Verify signature
        if (!hash_equals($expected, $signature)) {
            return new WP_Error('unauthorized', 'Invalid webhook signature', array('status' => 401));
        }
        
        return true;
    }
    
    /**
     * Process incoming webhook
     */
    public function process($data) {
        return $this->handle_webhook(new WP_REST_Request('POST', '/aargo/v1/shiprocket-webhook'));
    }
    
    /**
     * Handle webhook request
     */
    public function handle_webhook($request) {
        $data = $request->get_json_params();
        
        // Log webhook
        Aargo_Shiprocket_DB::log_webhook($data['event'] ?? 'unknown', $data);
        
        $event = $data['event'] ?? '';
        $awb = $data['awb'] ?? '';
        
        if (empty($awb)) {
            return new WP_REST_Response(array('status' => 'ignored'), 200);
        }
        
        // Find WooCommerce order by AWB
        $order = $this->get_order_by_awb($awb);
        
        if (!$order) {
            return new WP_REST_Response(array('status' => 'order_not_found'), 200);
        }
        
        // Process based on event
        switch ($event) {
            case 'shipment.shipped':
            case 'SHIPMENT_SHIPPED':
                $this->handle_shipped($order, $data);
                break;
                
            case 'shipment.out_for_delivery':
            case 'OUT_FOR_DELIVERY':
                $this->handle_out_for_delivery($order, $data);
                break;
                
            case 'shipment.delivered':
            case 'DELIVERED':
                $this->handle_delivered($order, $data);
                break;
                
            case 'shipment.undelivered':
            case 'UNDELIVERED':
                $this->handle_undelivered($order, $data);
                break;
                
            case 'shipment.rto':
            case 'RTO':
                $this->handle_rto($order, $data);
                break;
                
            case 'ndr.created':
            case 'NDR_CREATED':
                $this->handle_ndr($order, $data);
                break;
                
            default:
                $this->handle_generic_update($order, $data);
        }
        
        return new WP_REST_Response(array('status' => 'processed'), 200);
    }
    
    /**
     * Handle shipped event
     */
    private function handle_shipped($order, $data) {
        $order->update_meta_data('_shiprocket_status', 'Shipped');
        $order->update_status('shipped');
        $order->add_order_note('Shipped via ' . ($data['courier'] ?? 'courier'));
        $order->save();
        
        // Send email notification
        $this->send_customer_email($order, 'shipped', $data);
    }
    
    /**
     * Handle out for delivery
     */
    private function handle_out_for_delivery($order, $data) {
        $order->update_meta_data('_shiprocket_status', 'Out for Delivery');
        $order->add_order_note('Out for delivery today');
        $order->save();
        
        $this->send_customer_email($order, 'out_for_delivery', $data);
    }
    
    /**
     * Handle delivered
     */
    private function handle_delivered($order, $data) {
        $order->update_meta_data('_shiprocket_status', 'Delivered');
        $order->update_meta_data('_delivered_date', current_time('mysql'));
        $order->update_status('completed');
        $order->add_order_note('Delivered successfully');
        $order->save();
        
        // Update courier history for smart selection
        $courier = $order->get_meta('_courier_name');
        if ($courier) {
            $smart_courier = new Aargo_Shiprocket_Smart_Courier();
            $smart_courier->update_courier_history($courier, 'delivered');
        }
        
        $this->send_customer_email($order, 'delivered', $data);
    }
    
    /**
     * Handle undelivered
     */
    private function handle_undelivered($order, $data) {
        $order->update_meta_data('_shiprocket_status', 'Undelivered');
        $order->add_order_note('Delivery failed: ' . ($data['reason'] ?? 'Unknown reason'));
        $order->save();
        
        $this->log_ndr($order, $data);
        $this->send_customer_email($order, 'ndr', $data);
    }
    
    /**
     * Handle RTO
     */
    private function handle_rto($order, $data) {
        $order->update_meta_data('_shiprocket_status', 'RTO');
        $order->update_status('failed');
        $order->add_order_note('Return to Origin initiated');
        $order->save();
        
        // Update courier history
        $courier = $order->get_meta('_courier_name');
        if ($courier) {
            $smart_courier = new Aargo_Shiprocket_Smart_Courier();
            $smart_courier->update_courier_history($courier, 'rto');
        }
    }
    
    /**
     * Handle NDR
     */
    private function handle_ndr($order, $data) {
        $this->log_ndr($order, $data);
        
        $order->update_meta_data('_shiprocket_status', 'NDR');
        $order->add_order_note('NDR created: ' . ($data['reason'] ?? 'Action needed'));
        $order->save();
        
        // Update courier history
        $courier = $order->get_meta('_courier_name');
        if ($courier) {
            $smart_courier = new Aargo_Shiprocket_Smart_Courier();
            $smart_courier->update_courier_history($courier, 'ndr');
        }
        
        // Trigger NDR automation hook
        do_action('aargo_ndr_created', $order->get_id(), $data);
    }
    
    /**
     * Handle generic update
     */
    private function handle_generic_update($order, $data) {
        $status = $data['current_status'] ?? 'Updated';
        $order->update_meta_data('_shiprocket_status', $status);
        $order->add_order_note('Shiprocket update: ' . $status);
        $order->save();
    }
    
    /**
     * Get order by AWB
     */
    private function get_order_by_awb($awb) {
        $orders = wc_get_orders(array(
            'meta_key' => '_awb_number',
            'meta_value' => $awb,
            'limit' => 1
        ));
        
        return !empty($orders) ? $orders[0] : null;
    }
    
    /**
     * Log NDR
     */
    private function log_ndr($order, $data) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_ndr';
        
        $wpdb->insert($table, array(
            'wc_order_id' => $order->get_id(),
            'awb_number' => $data['awb'] ?? '',
            'ndr_code' => $data['ndr_code'] ?? '',
            'ndr_reason' => $data['reason'] ?? '',
            'created_at' => current_time('mysql')
        ));
    }
    
    /**
     * Send customer email
     */
    private function send_customer_email($order, $type, $data) {
        $email = $order->get_billing_email();
        $order_id = $order->get_order_number();
        $awb = $order->get_meta('_awb_number');
        
        $subject = '';
        $message = '';
        
        switch ($type) {
            case 'shipped':
                $subject = 'Your order #' . $order_id . ' has been shipped!';
                $message = "Hi {$order->get_billing_first_name()},\n\n";
                $message .= "Great news! Your order #{$order_id} has been shipped.\n\n";
                $message .= "AWB: {$awb}\n";
                $message .= "Courier: " . ($data['courier'] ?? 'Courier') . "\n";
                $message .= "Track: " . Aargo_Shiprocket_Tracking::get_tracking_page_url() . "\n\n";
                $message .= "Thank you for shopping with Aargo Lifestyle!";
                break;
                
            case 'out_for_delivery':
                $subject = 'Your order #' . $order_id . ' is out for delivery!';
                $message = "Hi {$order->get_billing_first_name()},\n\n";
                $message .= "Your order #{$order_id} is out for delivery today.\n\n";
                $message .= "Please ensure someone is available to receive the package.\n\n";
                $message .= "Track: " . Aargo_Shiprocket_Tracking::get_tracking_page_url() . "\n\n";
                $message .= "Thank you for shopping with Aargo Lifestyle!";
                break;
                
            case 'delivered':
                $subject = 'Your order #' . $order_id . ' has been delivered!';
                $message = "Hi {$order->get_billing_first_name()},\n\n";
                $message .= "Your order #{$order_id} has been delivered successfully!\n\n";
                $message .= "We hope you love your Aargo Lifestyle products.\n";
                $message .= "Please share your feedback with us.\n\n";
                $message .= "Thank you for shopping with us!";
                break;
                
            case 'ndr':
                $subject = 'Action needed for your order #' . $order_id;
                $message = "Hi {$order->get_billing_first_name()},\n\n";
                $message .= "There was an issue delivering your order #{$order_id}.\n\n";
                $message .= "Reason: " . ($data['reason'] ?? 'Delivery issue') . "\n\n";
                $message .= "Please contact us to resolve this.\n\n";
                $message .= "Thank you for your patience.";
                break;
        }
        
        if ($subject && $message) {
            wp_mail($email, $subject, $message);
        }
    }
    
    /**
     * Get webhook URL
     */
    public static function get_webhook_url() {
        return rest_url('aargo/v1/shiprocket-webhook');
    }
}
