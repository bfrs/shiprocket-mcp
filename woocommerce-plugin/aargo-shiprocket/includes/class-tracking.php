<?php
/**
 * Tracking - Customer tracking page and order tracking
 */

class Aargo_Shiprocket_Tracking {
    
    public function __construct() {
        // Enqueue public scripts
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
    }
    
    /**
     * Get order tracking information
     */
    public function get_order_tracking($data) {
        $order_id = isset($data['order_id']) ? sanitize_text_field($data['order_id']) : '';
        $email = isset($data['email']) ? sanitize_email($data['email']) : '';
        
        if (empty($order_id) && empty($email)) {
            return new WP_Error('missing_data', 'Please provide order ID or email', array('status' => 400));
        }
        
        // Find order
        $order = $this->find_order($order_id, $email);
        
        if (!$order) {
            return new WP_Error('not_found', 'Order not found', array('status' => 404));
        }
        
        $awb = $order->get_meta('_awb_number');
        $sr_order_id = $order->get_meta('_shiprocket_order_id');
        
        if (empty($awb) && empty($sr_order_id)) {
            return array(
                'success' => true,
                'data' => array(
                    'order_id' => $order->get_order_number(),
                    'status' => 'Processing',
                    'message' => 'Your order is being prepared for shipment',
                    'timeline' => array()
                )
            );
        }
        
        // Get tracking from Shiprocket
        $client = new Aargo_Shiprocket_MCP_Client();
        $result = $client->track_order($awb, $sr_order_id);
        
        if ($result['success']) {
            $tracking_data = $result['data'];
            
            return array(
                'success' => true,
                'data' => array(
                    'order_id' => $order->get_order_number(),
                    'awb' => $awb,
                    'courier' => $order->get_meta('_courier_name'),
                    'status' => $tracking_data['current_status'] ?? 'In Transit',
                    'expected_delivery' => $tracking_data['edd'] ?? 'N/A',
                    'timeline' => $this->format_timeline($tracking_data['scans'] ?? array()),
                    'tracking_url' => $this->get_courier_tracking_url($awb, $order->get_meta('_courier_name'))
                )
            );
        }
        
        return new WP_Error('tracking_error', 'Unable to fetch tracking', array('status' => 500));
    }
    
    /**
     * Find order by ID or email
     */
    private function find_order($order_id, $email) {
        if ($order_id) {
            // Try to find by order ID or order number
            $order = wc_get_order($order_id);
            
            if (!$order) {
                // Try by order number
                $orders = wc_get_orders(array(
                    'order_number' => $order_id,
                    'limit' => 1
                ));
                
                if (!empty($orders)) {
                    $order = $orders[0];
                }
            }
            
            if ($order && $email && $order->get_billing_email() !== $email) {
                return null;
            }
            
            return $order;
        }
        
        if ($email) {
            // Find most recent order by email
            $orders = wc_get_orders(array(
                'billing_email' => $email,
                'limit' => 1,
                'orderby' => 'date',
                'order' => 'DESC'
            ));
            
            return !empty($orders) ? $orders[0] : null;
        }
        
        return null;
    }
    
    /**
     * Format tracking timeline
     */
    private function format_timeline($scans) {
        $timeline = array();
        
        foreach ($scans as $scan) {
            $timeline[] = array(
                'status' => $scan['status'] ?? 'In Transit',
                'location' => $scan['location'] ?? 'N/A',
                'date' => $scan['date'] ?? 'N/A',
                'time' => $scan['time'] ?? 'N/A',
                'activity' => $scan['activity'] ?? 'Shipment updated'
            );
        }
        
        return $timeline;
    }
    
    /**
     * Get courier tracking URL
     */
    private function get_courier_tracking_url($awb, $courier) {
        $courier = strtolower($courier);
        
        $urls = array(
            'delhivery' => 'https://www.delhivery.com/track/package/' . $awb,
            'ekart' => 'https://ekartlogistics.com/track/',
            'bluedart' => 'https://www.bluedart.com/track/',
            'dtdc' => 'https://tracking.dtdc.com/',
            'fedex' => 'https://www.fedex.com/apps/fedextrack/?tracknumbers=' . $awb,
            'ecom' => 'https://ecomexpress.in/tracking/',
        );
        
        foreach ($urls as $key => $url) {
            if (strpos($courier, $key) !== false) {
                return $url;
            }
        }
        
        return 'https://shiprocket.in/tracking/' . $awb;
    }
    
    /**
     * Enqueue public scripts
     */
    public function enqueue_scripts() {
        wp_enqueue_style('aargo-sr-tracking', AARGO_SR_PLUGIN_URL . 'assets/css/tracking.css', array(), AARGO_SR_VERSION);
        wp_enqueue_script('aargo-sr-tracking', AARGO_SR_PLUGIN_URL . 'assets/js/tracking.js', array('jquery'), AARGO_SR_VERSION, true);
        wp_localize_script('aargo-sr-tracking', 'aargo_tracking_ajax', array(
            'ajax_url' => rest_url('aargo/v1/track-order'),
            'nonce' => wp_create_nonce('wp_rest')
        ));
    }
    
    /**
     * Get tracking page URL
     */
    public static function get_tracking_page_url() {
        $page = get_page_by_path('order-tracking');
        
        if ($page) {
            return get_permalink($page->ID);
        }
        
        return home_url('/track-order');
    }
    
    /**
     * Create tracking page on activation
     */
    public static function create_tracking_page() {
        $page = get_page_by_path('order-tracking');
        
        if (!$page) {
            wp_insert_post(array(
                'post_title' => 'Track Your Order',
                'post_content' => '[aargo_tracking]',
                'post_status' => 'publish',
                'post_type' => 'page',
                'post_name' => 'order-tracking'
            ));
        }
    }
}
