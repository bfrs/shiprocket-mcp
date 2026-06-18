<?php
/**
 * MCP Client - HTTP wrapper for Shiprocket MCP Server
 */

class Aargo_Shiprocket_MCP_Client {
    
    private $base_url;
    private $auth_token;
    private $timeout = 30;
    
    public function __construct() {
        $this->base_url = rtrim(get_option('aargo_sr_mcp_url', 'http://localhost:3000'), '/');
        $this->auth_token = get_option('aargo_sr_mcp_token', '');
    }
    
    /**
     * Call an MCP tool
     */
    public function call_tool($tool_name, $arguments = array()) {
        $url = $this->base_url . '/mcp';
        
        $payload = array(
            'jsonrpc' => '2.0',
            'method' => 'tools/call',
            'params' => array(
                'name' => $tool_name,
                'arguments' => $arguments
            ),
            'id' => uniqid()
        );
        
        $headers = array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $this->auth_token
        );
        
        // Reuse session ID from initialize_session() if available
        if (!empty($this->session_id)) {
            $headers['mcp-session-id'] = $this->session_id;
        }
        
        $args = array(
            'method' => 'POST',
            'timeout' => $this->timeout,
            'headers' => $headers,
            'body' => json_encode($payload)
        );
        
        $response = wp_remote_post($url, $args);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message()
            );
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return array(
                'success' => false,
                'error' => 'Invalid JSON response'
            );
        }
        
        if (isset($data['error'])) {
            return array(
                'success' => false,
                'error' => $data['error']['message'] ?? 'Unknown error'
            );
        }
        
        return array(
            'success' => true,
            'data' => $data['result'] ?? $data
        );
    }
    
    /**
     * Initialize MCP session
     */
    public function initialize_session() {
        $url = $this->base_url . '/mcp';
        
        $payload = array(
            'jsonrpc' => '2.0',
            'method' => 'initialize',
            'params' => array(
                'protocolVersion' => '2024-11-05',
                'capabilities' => array(),
                'clientInfo' => array(
                    'name' => 'aargo-woocommerce',
                    'version' => '1.0.0'
                )
            ),
            'id' => uniqid()
        );
        
        $args = array(
            'method' => 'POST',
            'timeout' => $this->timeout,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode($payload)
        );
        
        $response = wp_remote_post($url, $args);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $headers = wp_remote_retrieve_headers($response);
        $this->session_id = $headers['mcp-session-id'] ?? null;
        
        return !empty($this->session_id);
    }
    
    /**
     * Health check
     */
    public function health_check() {
        $url = $this->base_url . '/health';
        
        $response = wp_remote_get($url, array('timeout' => 5));
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $code = wp_remote_retrieve_response_code($response);
        return $code === 200;
    }
    
    /**
     * List available tools
     */
    public function list_tools() {
        return $this->call_tool('list_tools', array());
    }
    
    /**
     * Create order in Shiprocket
     */
    public function create_order($order_data) {
        return $this->call_tool('order_create', $order_data);
    }
    
    /**
     * Ship an order
     */
    public function ship_order($order_id, $courier_id = null) {
        $args = array('order_id' => $order_id);
        if ($courier_id) {
            $args['courier_id'] = $courier_id;
        }
        return $this->call_tool('order_ship', $args);
    }
    
    /**
     * Track order/AWB
     */
    public function track_order($awb_number = null, $order_id = null) {
        $args = array();
        if ($awb_number) {
            $args['awb_number'] = $awb_number;
        }
        if ($order_id) {
            $args['order_id'] = $order_id;
        }
        return $this->call_tool('order_track', $args);
    }
    
    /**
     * Get shipping rates
     */
    public function get_rates($pickup_postcode, $delivery_postcode, $weight, $cod_or_prepaid = 'PREPAID') {
        return $this->call_tool('shipping_rate_calculator', array(
            'pickup_postcode' => $pickup_postcode,
            'delivery_postcode' => $delivery_postcode,
            'weight' => $weight,
            'cod_or_prepaid' => $cod_or_prepaid
        ));
    }
    
    /**
     * Generate label
     */
    public function generate_label($shipment_id) {
        return $this->call_tool('generate_shipment_label', array(
            'shipment_id' => $shipment_id
        ));
    }
    
    /**
     * List pickup addresses
     */
    public function list_pickup_addresses() {
        return $this->call_tool('list_pickup_addresses', array());
    }
    
    /**
     * Get order list
     */
    public function get_orders($status = null, $page = 1, $per_page = 10) {
        $args = array(
            'page' => $page,
            'per_page' => $per_page
        );
        if ($status) {
            $args['status'] = $status;
        }
        return $this->call_tool('order_list', $args);
    }
    
    /**
     * Schedule pickup
     */
    public function schedule_pickup($order_id, $pickup_date) {
        return $this->call_tool('order_schedule_pickup', array(
            'order_id' => $order_id,
            'pickup_date' => $pickup_date
        ));
    }

    /**
     * Create return
     */
    public function create_return($order_id, $reason, $reason_category = '', $items = array()) {
        return $this->call_tool('create_return', array(
            'order_id' => $order_id,
            'reason' => $reason,
            'reason_category' => $reason_category,
            'items' => $items
        ));
    }

    /**
     * Reattempt NDR
     */
    public function reattempt_ndr($awb_number, $action = 'reattempt', $address = '') {
        return $this->call_tool('reattempt_ndr', array(
            'awb_number' => $awb_number,
            'action' => $action,
            'address' => $address
        ));
    }

    /**
     * Generate manifest
     */
    public function generate_manifest($shipment_ids) {
        return $this->call_tool('generate_manifest', array(
            'shipment_ids' => $shipment_ids
        ));
    }
}
