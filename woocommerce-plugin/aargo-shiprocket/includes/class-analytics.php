<?php
/**
 * Analytics - Shipping analytics dashboard
 */

class Aargo_Shiprocket_Analytics {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_analytics_menu'));
    }
    
    public function add_analytics_menu() {
        add_submenu_page(
            'aargo-shiprocket',
            'Analytics',
            'Analytics',
            'manage_options',
            'aargo-shiprocket-analytics',
            array($this, 'analytics_page')
        );
    }
    
    public function analytics_page() {
        $stats = $this->get_dashboard_stats();
        $courier_report = $this->get_courier_report();
        $ndr_stats = $this->get_ndr_stats();
        
        ?>
        <div class="wrap">
            <h1>Shiprocket Analytics</h1>
            
            <div class="aargo-analytics-dashboard">
                <!-- KPI Cards -->
                <div class="aargo-kpi-grid">
                    <div class="aargo-kpi-card">
                        <h3>Total Orders</h3>
                        <div class="kpi-value"><?php echo esc_html($stats['total_orders']); ?></div>
                        <div class="kpi-label">All time</div>
                    </div>
                    
                    <div class="aargo-kpi-card">
                        <h3>Delivered</h3>
                        <div class="kpi-value kpi-success"><?php echo esc_html($stats['delivered']); ?></div>
                        <div class="kpi-label"><?php echo esc_html($stats['delivery_rate']); ?>% success</div>
                    </div>
                    
                    <div class="aargo-kpi-card">
                        <h3>In Transit</h3>
                        <div class="kpi-value kpi-info"><?php echo esc_html($stats['in_transit']); ?></div>
                        <div class="kpi-label">Active shipments</div>
                    </div>
                    
                    <div class="aargo-kpi-card">
                        <h3>NDR / RTO</h3>
                        <div class="kpi-value kpi-warning"><?php echo esc_html($stats['ndr_rto']); ?></div>
                        <div class="kpi-label"><?php echo esc_html($stats['ndr_rate']); ?>% rate</div>
                    </div>
                    
                    <div class="aargo-kpi-card">
                        <h3>Avg Cost</h3>
                        <div class="kpi-value">₹<?php echo esc_html($stats['avg_cost']); ?></div>
                        <div class="kpi-label">Per shipment</div>
                    </div>
                    
                    <div class="aargo-kpi-card">
                        <h3>Today's Orders</h3>
                        <div class="kpi-value"><?php echo esc_html($stats['today_orders']); ?></div>
                        <div class="kpi-label"><?php echo date('d M Y'); ?></div>
                    </div>
                </div>
                
                <!-- Courier Performance -->
                <div class="aargo-section">
                    <h2>Courier Performance</h2>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Courier</th>
                                <th>Total</th>
                                <th>Delivered</th>
                                <th>Delivery Rate</th>
                                <th>RTO Rate</th>
                                <th>NDR Rate</th>
                                <th>Avg Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($courier_report as $courier => $data): ?>
                            <tr>
                                <td><?php echo esc_html(ucwords(str_replace('-', ' ', $courier))); ?></td>
                                <td><?php echo esc_html($data['total']); ?></td>
                                <td><?php echo esc_html($data['delivered']); ?></td>
                                <td><?php echo esc_html($data['delivery_rate']); ?></td>
                                <td><?php echo esc_html($data['rto_rate']); ?></td>
                                <td><?php echo esc_html($data['ndr_rate']); ?></td>
                                <td>₹<?php echo esc_html($data['avg_cost'] ?? 'N/A'); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                
                <!-- NDR Trends -->
                <div class="aargo-section">
                    <h2>NDR Trends</h2>
                    <div class="aargo-chart-container">
                        <canvas id="ndr-chart"></canvas>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="aargo-section">
                    <h2>Recent Activity</h2>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Status</th>
                                <th>Courier</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($this->get_recent_activity() as $activity): ?>
                            <tr>
                                <td><a href="<?php echo esc_url(admin_url('post.php?post=' . $activity['order_id'] . '&action=edit')); ?>">
                                    #<?php echo esc_html($activity['order_number']); ?></a>
                                </td>
                                <td><?php echo esc_html($activity['status']); ?></td>
                                <td><?php echo esc_html($activity['courier']); ?></td>
                                <td><?php echo esc_html(human_time_diff(strtotime($activity['updated']), current_time('timestamp'))); ?> ago</td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }
    
    private function get_dashboard_stats() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_sync';
        
        $total = $wpdb->get_var("SELECT COUNT(*) FROM $table");
        $delivered = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE status = 'delivered'");
        $in_transit = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE status IN ('shipped', 'out_for_delivery')");
        $ndr_rto = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE status IN ('ndr', 'rto')");
        $avg_cost = $wpdb->get_var("SELECT AVG(shipping_cost) FROM $table WHERE shipping_cost > 0");
        
        $today = $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE DATE(created_at) = CURDATE()");
        
        return array(
            'total_orders' => $total ?: 0,
            'delivered' => $delivered ?: 0,
            'in_transit' => $in_transit ?: 0,
            'ndr_rto' => $ndr_rto ?: 0,
            'delivery_rate' => $total > 0 ? round(($delivered / $total) * 100, 1) : 0,
            'ndr_rate' => $total > 0 ? round(($ndr_rto / $total) * 100, 1) : 0,
            'avg_cost' => round($avg_cost ?: 0, 2),
            'today_orders' => $today ?: 0
        );
    }
    
    private function get_courier_report() {
        $history = get_option('aargo_sr_courier_history', array());
        $report = array();
        
        foreach ($history as $courier => $data) {
            $total = $data['total'] ?? 0;
            if ($total > 0) {
                $report[$courier] = array(
                    'total' => $total,
                    'delivered' => $data['delivered'] ?? 0,
                    'delivery_rate' => round(($data['delivered'] / $total) * 100, 1) . '%',
                    'rto_rate' => round(($data['rto'] / $total) * 100, 1) . '%',
                    'ndr_rate' => round(($data['ndr'] / $total) * 100, 1) . '%',
                    'avg_cost' => 'N/A'
                );
            }
        }
        
        return $report;
    }
    
    private function get_ndr_stats() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_ndr';
        
        return $wpdb->get_results(
            "SELECT DATE(created_at) as date, COUNT(*) as count 
             FROM $table 
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date ASC"
        );
    }
    
    private function get_recent_activity() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aargo_shiprocket_sync';
        
        $results = $wpdb->get_results(
            "SELECT wc_order_id, status, courier_name, updated_at
             FROM $table
             ORDER BY updated_at DESC
             LIMIT 20"
        );
        
        $activity = array();
        foreach ($results as $row) {
            $order = wc_get_order($row->wc_order_id);
            if ($order) {
                $activity[] = array(
                    'order_id' => $row->wc_order_id,
                    'order_number' => $order->get_order_number(),
                    'status' => $row->status,
                    'courier' => $row->courier_name,
                    'updated' => $row->updated_at
                );
            } else {
                // Order deleted but still in sync table - show basic info
                $activity[] = array(
                    'order_id' => $row->wc_order_id,
                    'order_number' => '#' . $row->wc_order_id,
                    'status' => $row->status,
                    'courier' => $row->courier_name,
                    'updated' => $row->updated_at
                );
            }
        }
        
        return $activity;
    }
}
