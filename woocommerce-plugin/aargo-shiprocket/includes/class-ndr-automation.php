<?php
/**
 * NDR Automation - Proactive handling of non-delivery reports
 */

class Aargo_Shiprocket_NDR_Automation {
    
    public function __construct() {
        // Hook into webhook for NDR events
        add_action('aargo_ndr_created', array($this, 'handle_ndr'), 10, 2);
        
        // Daily NDR check cron
        add_action('aargo_daily_ndr_check', array($this, 'check_pending_ndrs'));
        
        // Register cron if not exists
        if (!wp_next_scheduled('aargo_daily_ndr_check')) {
            wp_schedule_event(time(), 'daily', 'aargo_daily_ndr_check');
        }
    }
    
    /**
     * Handle new NDR
     */
    public function handle_ndr($order_id, $ndr_data) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $reason = $ndr_data['reason'] ?? '';
        $code = $ndr_data['code'] ?? '';
        
        // Log NDR
        $this->log_ndr($order_id, $ndr_data);
        
        // Auto-action based on reason
        $action = $this->determine_action($reason, $code);
        
        switch ($action) {
            case 'reattempt':
                $this->auto_reattempt($order, $ndr_data);
                break;
                
            case 'contact_customer':
                $this->contact_customer($order, $ndr_data);
                break;
                
            case 'mark_rto':
                $this->mark_rto($order, $ndr_data);
                break;
                
            case 'manual_review':
                $this->flag_for_review($order, $ndr_data);
                break;
        }
        
        // Notify admin
        $this->notify_admin($order, $ndr_data, $action);
    }
    
    /**
     * Determine action based on NDR reason
     */
    private function determine_action($reason, $code) {
        $auto_reattempt_reasons = array(
            'customer not available',
            'door locked',
            'consignee absent',
            'office closed',
            'residence locked'
        );
        
        $rto_reasons = array(
            'wrong address',
            'address not found',
            'consignee shifted',
            'house demolished',
            'address incomplete'
        );
        
        $reason_lower = strtolower($reason);
        
        // Check for auto-reattempt
        foreach ($auto_reattempt_reasons as $r) {
            if (strpos($reason_lower, $r) !== false) {
                return 'reattempt';
            }
        }
        
        // Check for RTO
        foreach ($rto_reasons as $r) {
            if (strpos($reason_lower, $r) !== false) {
                return 'mark_rto';
            }
        }
        
        // Contact customer for these reasons
        $contact_reasons = array(
            'phone not reachable',
            'wrong phone',
            'customer refused'
        );
        
        foreach ($contact_reasons as $r) {
            if (strpos($reason_lower, $r) !== false) {
                return 'contact_customer';
            }
        }
        
        // Default: manual review
        return 'manual_review';
    }
    
    /**
     * Auto-reattempt delivery
     */
    private function auto_reattempt($order, $ndr_data) {
        $client = new Aargo_Shiprocket_MCP_Client();
        
        $awb_number = $ndr_data['awb'] ?? '';
        if (empty($awb_number)) {
            return;
        }
        
        $result = $client->reattempt_ndr($awb_number, 'reattempt');
        
        if ($result['success']) {
            $order->add_order_note('NDR auto-reattempt scheduled. Reason: ' . $ndr_data['reason']);
            $order->update_meta_data('_ndr_action', 'reattempt');
            $order->save();
            
            // Email customer
            $this->send_reattempt_email($order);
        } else {
            $order->add_order_note('NDR reattempt failed: ' . ($result['error'] ?? 'Unknown error'));
            $order->save();
        }
    }
    
    /**
     * Contact customer for NDR
     */
    private function contact_customer($order, $ndr_data) {
        $email = $order->get_billing_email();
        $phone = $order->get_billing_phone();
        
        $subject = 'Action needed for your order #' . $order->get_order_number();
        $message = "Hi {$order->get_billing_first_name()},\n\n";
        $message .= "We tried to deliver your order #{$order->get_order_number()} but encountered an issue:\n\n";
        $message .= "Reason: {$ndr_data['reason']}\n\n";
        $message .= "Please contact us to resolve this:\n";
        $message .= "Phone: +91-XXXXXXXXXX\n";
        $message .= "Email: support@aargolifestyle.com\n\n";
        $message .= "Thank you for your patience.";
        
        wp_mail($email, $subject, $message);
        
        $order->add_order_note('Customer contacted for NDR: ' . $ndr_data['reason']);
        $order->update_meta_data('_ndr_action', 'contact_customer');
        $order->save();
    }
    
    /**
     * Mark for RTO
     */
    private function mark_rto($order, $ndr_data) {
        $client = new Aargo_Shiprocket_MCP_Client();
        
        $awb = $order->get_meta('_awb_number');
        if (empty($awb)) {
            return;
        }
        
        // Note: mark_rto tool would need to be called here
        // For now, log it for manual action
        
        $order->add_order_note('RTO recommended: ' . $ndr_data['reason']);
        $order->update_meta_data('_ndr_action', 'mark_rto');
        $order->update_meta_data('_rto_reason', $ndr_data['reason']);
        $order->save();
        
        // Email customer about RTO
        $this->send_rto_email($order, $ndr_data);
    }
    
    /**
     * Flag for manual review
     */
    private function flag_for_review($order, $ndr_data) {
        $order->add_order_note('⚠️ NDR requires manual review: ' . $ndr_data['reason']);
        $order->update_meta_data('_ndr_action', 'manual_review');
        $order->update_meta_data('_ndr_flagged', 'yes');
        $order->save();
        
        // High priority email to admin
        $this->send_admin_alert($order, $ndr_data);
    }
    
    /**
     * Check pending NDRs daily
     */
    public function check_pending_ndrs() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_ndr';
        
        // Get unresolved NDRs older than 24 hours
        $ndrs = $wpdb->get_results(
            "SELECT * FROM $table 
             WHERE resolved = 0 
             AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        
        foreach ($ndrs as $ndr) {
            $order = wc_get_order($ndr->wc_order_id);
            if (!$order) {
                continue;
            }
            
            // Escalate to admin
            $this->send_admin_escalation($order, $ndr);
        }
    }
    
    /**
     * Send reattempt email to customer
     */
    private function send_reattempt_email($order) {
        $email = $order->get_billing_email();
        
        $subject = 'We will reattempt delivery for order #' . $order->get_order_number();
        $message = "Hi {$order->get_billing_first_name()},\n\n";
        $message .= "We missed you during delivery for order #{$order->get_order_number()}.\n\n";
        $message .= "We will reattempt delivery within 1-2 business days.\n\n";
        $message .= "Please ensure someone is available to receive the package.\n\n";
        $message .= "Thank you for shopping with Aargo Lifestyle!";
        
        wp_mail($email, $subject, $message);
    }
    
    /**
     * Send RTO email to customer
     */
    private function send_rto_email($order, $ndr_data) {
        $email = $order->get_billing_email();
        
        $subject = 'Important: Delivery issue with order #' . $order->get_order_number();
        $message = "Hi {$order->get_billing_first_name()},\n\n";
        $message .= "We encountered a delivery issue with your order #{$order->get_order_number()}:\n\n";
        $message .= "Reason: {$ndr_data['reason']}\n\n";
        $message .= "We may need to return the package to our warehouse.\n\n";
        $message .= "Please contact us immediately to resolve this:\n";
        $message .= "Phone: +91-XXXXXXXXXX\n";
        $message .= "Email: support@aargolifestyle.com\n\n";
        $message .= "Thank you for your patience.";
        
        wp_mail($email, $subject, $message);
    }
    
    /**
     * Send admin alert
     */
    private function send_admin_alert($order, $ndr_data) {
        $admin_email = get_option('admin_email');
        
        $subject = 'NDR Alert: Order #' . $order->get_order_number() . ' requires manual review';
        $message = "NDR requires manual review:\n\n";
        $message .= "Order: #{$order->get_order_number()}\n";
        $message .= "AWB: {$order->get_meta('_awb_number')}\n";
        $message .= "Reason: {$ndr_data['reason']}\n";
        $message .= "Customer: {$order->get_billing_first_name()} {$order->get_billing_last_name()}\n";
        $message .= "Phone: {$order->get_billing_phone()}\n";
        $message .= "Email: {$order->get_billing_email()}\n\n";
        $message .= "Admin: " . admin_url('post.php?post=' . $order->get_id() . '&action=edit');
        
        wp_mail($admin_email, $subject, $message);
    }
    
    /**
     * Send admin escalation
     */
    private function send_admin_escalation($order, $ndr) {
        $admin_email = get_option('admin_email');
        
        $subject = 'ESCALATION: NDR unresolved for 24+ hours - Order #' . $order->get_order_number();
        $message = "NDR has been unresolved for 24+ hours:\n\n";
        $message .= "Order: #{$order->get_order_number()}\n";
        $message .= "AWB: {$ndr->awb_number}\n";
        $message .= "NDR Reason: {$ndr->ndr_reason}\n";
        $message .= "Created: {$ndr->created_at}\n\n";
        $message .= "Immediate action required!\n";
        
        wp_mail($admin_email, $subject, $message);
    }
    
    /**
     * Notify admin of NDR action
     */
    private function notify_admin($order, $ndr_data, $action) {
        $admin_email = get_option('admin_email');
        
        $action_labels = array(
            'reattempt' => 'Auto-reattempt scheduled',
            'contact_customer' => 'Customer contacted',
            'mark_rto' => 'RTO recommended',
            'manual_review' => 'Flagged for manual review'
        );
        
        $subject = 'NDR Action: Order #' . $order->get_order_number();
        $message = "NDR processed for order #{$order->get_order_number()}\n\n";
        $message .= "Action: {$action_labels[$action]}\n";
        $message .= "Reason: {$ndr_data['reason']}\n";
        
        wp_mail($admin_email, $subject, $message);
    }
    
    /**
     * Log NDR to database
     */
    private function log_ndr($order_id, $ndr_data) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_ndr';
        
        $wpdb->insert($table, array(
            'wc_order_id' => $order_id,
            'awb_number' => $ndr_data['awb'] ?? '',
            'ndr_code' => $ndr_data['code'] ?? '',
            'ndr_reason' => $ndr_data['reason'] ?? '',
            'created_at' => current_time('mysql')
        ));
    }
}
