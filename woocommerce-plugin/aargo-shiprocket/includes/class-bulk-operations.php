<?php
/**
 * Bulk Operations - Batch processing of orders
 */

class Aargo_Shiprocket_Bulk_Operations {
    
    public function __construct() {
        // Add bulk actions to orders list
        add_filter('bulk_actions-edit-shop_order', array($this, 'add_bulk_actions'));
        add_filter('handle_bulk_actions-edit-shop_order', array($this, 'handle_bulk_actions'), 10, 3);
        
        // Add bulk actions to HPOS orders list
        add_filter('bulk_actions-woocommerce_page_wc-orders', array($this, 'add_bulk_actions'));
        add_filter('handle_bulk_actions-woocommerce_page_wc-orders', array($this, 'handle_bulk_actions'), 10, 3);
        
        // Admin notices
        add_action('admin_notices', array($this, 'bulk_action_notices'));
    }
    
    /**
     * Add bulk actions to dropdown
     */
    public function add_bulk_actions($actions) {
        $actions['aargo_sync'] = 'Sync to Shiprocket';
        $actions['aargo_ship'] = 'Ship orders';
        $actions['aargo_generate_labels'] = 'Generate labels';
        $actions['aargo_manifest'] = 'Generate manifest';
        return $actions;
    }
    
    /**
     * Handle bulk actions
     */
    public function handle_bulk_actions($redirect_to, $action, $post_ids) {
        if (!in_array($action, array('aargo_sync', 'aargo_ship', 'aargo_generate_labels', 'aargo_manifest'))) {
            return $redirect_to;
        }
        
        $processed = 0;
        $failed = 0;
        
        foreach ($post_ids as $post_id) {
            $order = wc_get_order($post_id);
            if (!$order) {
                continue;
            }
            
            switch ($action) {
                case 'aargo_sync':
                    $result = $this->sync_order($order);
                    break;
                    
                case 'aargo_ship':
                    $result = $this->ship_order($order);
                    break;
                    
                case 'aargo_generate_labels':
                    $result = $this->generate_label($order);
                    break;
                    
                case 'aargo_manifest':
                    // Manifest is processed after all orders
                    $result = true;
                    break;
            }
            
            if ($result) {
                $processed++;
            } else {
                $failed++;
            }
        }
        
        // Generate manifest if needed
        if ($action === 'aargo_manifest' && $processed > 0) {
            $this->generate_manifest($post_ids);
        }
        
        $redirect_to = add_query_arg(array(
            'aargo_bulk_action' => $action,
            'processed' => $processed,
            'failed' => $failed,
        ), $redirect_to);
        
        return $redirect_to;
    }
    
    /**
     * Sync single order
     */
    private function sync_order($order) {
        $sync = new Aargo_Shiprocket_Order_Sync();
        $sync->sync_order_to_shiprocket($order->get_id());
        return !empty($order->get_meta('_shiprocket_order_id'));
    }
    
    /**
     * Ship single order
     */
    private function ship_order($order) {
        $sr_order_id = $order->get_meta('_shiprocket_order_id');
        if (empty($sr_order_id)) {
            // Auto-sync first
            $this->sync_order($order);
            $sr_order_id = $order->get_meta('_shiprocket_order_id');
        }
        
        if (empty($sr_order_id)) {
            return false;
        }
        
        $client = new Aargo_Shiprocket_MCP_Client();
        
        // Get smart courier selection
        $smart = new Aargo_Shiprocket_Smart_Courier();
        $courier = $smart->select_courier($order->get_id());
        
        $courier_id = $courier['courier_id'] ?? null;
        
        $result = $client->ship_order($sr_order_id, $courier_id);
        
        if ($result['success']) {
            $data = $result['data'];
            $order->update_meta_data('_awb_number', $data['awb']);
            $order->update_meta_data('_courier_name', $courier_name);
            $order->update_meta_data('_shiprocket_status', 'shipped');
            $order->add_order_note('Bulk shipped. AWB: ' . $data['awb']);
            $order->save();
            return true;
        }
        
        return false;
    }
    
    /**
     * Generate label for order
     */
    private function generate_label($order) {
        $shipment_id = $order->get_meta('_shipment_id');
        
        if (empty($shipment_id)) {
            return false;
        }
        
        $client = new Aargo_Shiprocket_MCP_Client();
        $result = $client->generate_label($shipment_id);
        
        if ($result['success']) {
            $order->update_meta_data('_label_url', $result['data']['label_url']);
            $order->add_order_note('Label generated');
            $order->save();
            return true;
        }
        
        return false;
    }
    
    /**
     * Generate manifest for orders
     */
    private function generate_manifest($order_ids) {
        $client = new Aargo_Shiprocket_MCP_Client();
        
        $shipment_ids = array();
        foreach ($order_ids as $order_id) {
            $order = wc_get_order($order_id);
            if ($order) {
                $shipment_id = $order->get_meta('_shipment_id');
                if ($shipment_id) {
                    $shipment_ids[] = $shipment_id;
                }
            }
        }
        
        if (empty($shipment_ids)) {
            return false;
        }
        
        $result = $client->generate_manifest($shipment_ids);
        
        if ($result['success']) {
            // Store manifest URL
            $manifest_url = $result['data']['manifest_url'] ?? '';
            $message = $result['data']['message'] ?? '';
            
            // Email to admin
            $admin_email = get_option('admin_email');
            $subject = 'Manifest generated for ' . count($awbs) . ' orders';
            $email_body = "Orders: " . implode(', ', $awbs) . "\n\n";
            if ($manifest_url) {
                $email_body .= "Manifest URL: {$manifest_url}\n";
            } else {
                $email_body .= "Note: {$message}\n";
            }
            
            wp_mail($admin_email, $subject, $email_body);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Admin notices for bulk actions
     */
    public function bulk_action_notices() {
        if (!empty($_REQUEST['aargo_bulk_action'])) {
            $action = sanitize_text_field($_REQUEST['aargo_bulk_action']);
            $processed = intval($_REQUEST['processed'] ?? 0);
            $failed = intval($_REQUEST['failed'] ?? 0);
            
            $action_labels = array(
                'aargo_sync' => 'synced to Shiprocket',
                'aargo_ship' => 'shipped',
                'aargo_generate_labels' => 'labels generated',
                'aargo_manifest' => 'manifest generated'
            );
            
            if ($processed > 0) {
                echo '<div class="notice notice-success">';
                echo '<p>' . sprintf(
                    _n('%d order %s.', '%d orders %s.', $processed, 'aargo-shiprocket'),
                    $processed,
                    $action_labels[$action]
                ) . '</p>';
                echo '</div>';
            }
            
            if ($failed > 0) {
                echo '<div class="notice notice-error">';
                echo '<p>' . sprintf(
                    _n('%d order failed.', '%d orders failed.', $failed, 'aargo-shiprocket'),
                    $failed
                ) . '</p>';
                echo '</div>';
            }
        }
    }
    
    /**
     * Daily bulk ship - cron job
     */
    public function daily_bulk_ship() {
        $orders = wc_get_orders(array(
            'status' => 'processing',
            'meta_query' => array(
                array(
                    'key' => '_shiprocket_order_id',
                    'compare' => 'NOT EXISTS'
                )
            ),
            'limit' => 100
        ));
        
        foreach ($orders as $order) {
            $this->sync_order($order);
            
            if (get_option('aargo_sr_auto_ship', 'no') === 'yes') {
                $this->ship_order($order);
            }
        }
    }
    
    /**
     * Daily manifest generation
     */
    public function daily_manifest() {
        $orders = wc_get_orders(array(
            'status' => 'shipped',
            'date_created' => '>=' . date('Y-m-d', strtotime('-1 day')),
            'limit' => -1
        ));
        
        $order_ids = array();
        foreach ($orders as $order) {
            $order_ids[] = $order->get_id();
        }
        
        if (!empty($order_ids)) {
            $this->generate_manifest($order_ids);
        }
    }
}
