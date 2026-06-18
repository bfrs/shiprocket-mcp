<?php
/**
 * Returns - Automated returns and exchanges
 */

class Aargo_Shiprocket_Returns {
    
    public function __construct() {
        // Handle return request submission
        add_action('wp_ajax_aargo_submit_return', array($this, 'handle_return_request'));
        add_action('wp_ajax_nopriv_aargo_submit_return', array($this, 'handle_return_request'));
    }
    
    /**
     * Return request shortcode
     */
    public function return_request_shortcode($atts) {
        ob_start();
        include AARGO_SR_PLUGIN_DIR . 'public/return-request.php';
        return ob_get_clean();
    }
    
    /**
     * Handle return request
     */
    public function handle_return_request() {
        check_ajax_referer('aargo_return_nonce', 'nonce');
        
        $order_id = isset($_POST['order_id']) ? sanitize_text_field($_POST['order_id']) : '';
        $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $reason = isset($_POST['reason']) ? sanitize_textarea_field($_POST['reason']) : '';
        $reason_category = isset($_POST['reason_category']) ? sanitize_text_field($_POST['reason_category']) : '';
        $return_type = isset($_POST['return_type']) ? sanitize_text_field($_POST['return_type']) : 'return';
        
        if (empty($order_id) || empty($email) || empty($reason)) {
            wp_send_json_error('Please fill all required fields');
        }
        
        // Find order
        $order = $this->find_order($order_id, $email);
        
        if (!$order) {
            wp_send_json_error('Order not found or email does not match');
        }
        
        // Check if order is eligible
        $eligible = $this->check_eligibility($order);
        
        if (!$eligible['eligible']) {
            wp_send_json_error($eligible['reason']);
        }
        
        // Create return in Shiprocket
        $client = new Aargo_Shiprocket_MCP_Client();
        
        $sr_order_id = $order->get_meta('_shiprocket_order_id');
        if (empty($sr_order_id)) {
            wp_send_json_error('Order not found in Shiprocket');
        }
        
        $result = $client->create_return($sr_order_id, $reason, $reason_category);
        
        if ($result['success']) {
            $data = $result['data'];
            
            // Store return data
            $this->log_return($order->get_id(), $data, $return_type, $reason, $reason_category);
            
            // Update order
            $order->add_order_note('Return request created: ' . $reason);
            $order->update_meta_data('_return_status', 'requested');
            $order->update_meta_data('_return_id', $data['return_id']);
            $order->save();
            
            // Send confirmation email
            $this->send_return_confirmation($order, $data, $reason);
            
            wp_send_json_success(array(
                'message' => 'Return request submitted successfully',
                'return_id' => $data['return_id']
            ));
        } else {
            wp_send_json_error('Failed to create return: ' . $result['error']);
        }
    }
    
    /**
     * Find order by ID and email
     */
    private function find_order($order_id, $email) {
        // Try by order ID
        $order = wc_get_order($order_id);
        
        if ($order && $order->get_billing_email() === $email) {
            return $order;
        }
        
        // Try by order number
        $orders = wc_get_orders(array(
            'order_number' => $order_id,
            'billing_email' => $email,
            'limit' => 1
        ));
        
        if (!empty($orders)) {
            return $orders[0];
        }
        
        return null;
    }
    
    /**
     * Check if order is eligible for return
     */
    private function check_eligibility($order) {
        // Check if order is delivered
        $status = $order->get_meta('_shiprocket_status');
        if ($status !== 'delivered') {
            return array(
                'eligible' => false,
                'reason' => 'Order must be delivered before requesting a return'
            );
        }
        
        // Check return window (e.g., 7 days)
        $delivered_date = $order->get_meta('_delivered_date');
        if ($delivered_date) {
            $days_since = (current_time('timestamp') - strtotime($delivered_date)) / DAY_IN_SECONDS;
            $return_window = intval(get_option('aargo_sr_return_window', 7));
            
            if ($days_since > $return_window) {
                return array(
                    'eligible' => false,
                    'reason' => 'Return window has expired (' . $return_window . ' days)'
                );
            }
        }
        
        // Check if already has return
        $return_status = $order->get_meta('_return_status');
        if (!empty($return_status)) {
            return array(
                'eligible' => false,
                'reason' => 'Return already requested for this order'
            );
        }
        
        return array('eligible' => true);
    }
    
    /**
     * Log return to database
     */
    private function log_return($order_id, $data, $type, $reason, $reason_category = '') {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_returns';
        
        $wpdb->insert($table, array(
            'wc_order_id' => $order_id,
            'shiprocket_return_id' => $data['return_id'] ?? '',
            'return_type' => $type,
            'status' => 'requested',
            'reason' => $reason,
            'reason_category' => $reason_category,
            'created_at' => current_time('mysql')
        ));
    }
    
    /**
     * Send return confirmation email
     */
    private function send_return_confirmation($order, $data, $reason) {
        $email = $order->get_billing_email();
        
        $subject = 'Return request received for order #' . $order->get_order_number();
        $message = "Hi {$order->get_billing_first_name()},\n\n";
        $message .= "We have received your return request for order #{$order->get_order_number()}.\n\n";
        $message .= "Return ID: {$data['return_id']}\n";
        $message .= "Reason: {$reason}\n\n";
        $message .= "Our team will review your request and get back to you within 24 hours.\n\n";
        $message .= "Thank you for shopping with Aargo Lifestyle!";
        
        wp_mail($email, $subject, $message);
        
        // Notify admin
        $admin_email = get_option('admin_email');
        $admin_subject = 'New return request - Order #' . $order->get_order_number();
        $admin_message = "Return request received:\n\n";
        $admin_message .= "Order: #{$order->get_order_number()}\n";
        $admin_message .= "Return ID: {$data['return_id']}\n";
        $admin_message .= "Reason: {$reason}\n";
        $admin_message .= "Customer: {$order->get_billing_first_name()} {$order->get_billing_last_name()}\n";
        $admin_message .= "Email: {$order->get_billing_email()}\n";
        
        wp_mail($admin_email, $admin_subject, $admin_message);
    }
    
    /**
     * Get return status
     */
    public function get_return_status($order_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_returns';
        
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE wc_order_id = %d ORDER BY id DESC LIMIT 1",
            $order_id
        ));
    }
    
    /**
     * Update return status from webhook
     */
    public function update_return_status($return_id, $status) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_returns';
        
        $wpdb->update($table, 
            array('status' => $status, 'updated_at' => current_time('mysql')),
            array('shiprocket_return_id' => $return_id)
        );
    }
}
