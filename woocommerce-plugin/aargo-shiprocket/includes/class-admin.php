<?php
/**
 * Admin - Settings and admin interface
 */

class Aargo_Shiprocket_Admin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // AJAX handlers
        add_action('wp_ajax_aargo_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_aargo_create_tracking_page', array($this, 'ajax_create_tracking_page'));
    }
    
    public function add_menu() {
        add_menu_page(
            __('Shiprocket', 'aargo-shiprocket'),
            __('Shiprocket', 'aargo-shiprocket'),
            'manage_options',
            'aargo-shiprocket',
            array($this, 'settings_page'),
            'dashicons-cart',
            58
        );
    }
    
    public function register_settings() {
        register_setting('aargo_sr_settings', 'aargo_sr_mcp_url');
        register_setting('aargo_sr_settings', 'aargo_sr_mcp_token');
        register_setting('aargo_sr_settings', 'aargo_sr_auto_sync');
        register_setting('aargo_sr_settings', 'aargo_sr_auto_ship');
        register_setting('aargo_sr_settings', 'aargo_sr_pickup_postcode');
        register_setting('aargo_sr_settings', 'aargo_sr_default_dimensions');
        register_setting('aargo_sr_settings', 'aargo_sr_webhook_secret');
    }
    
    public function enqueue_scripts($hook) {
        if ($hook !== 'toplevel_page_aargo-shiprocket') {
            return;
        }
        
        wp_enqueue_style('aargo-sr-admin', AARGO_SR_PLUGIN_URL . 'assets/css/admin.css', array(), AARGO_SR_VERSION);
        wp_enqueue_script('aargo-sr-admin', AARGO_SR_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), AARGO_SR_VERSION, true);
        wp_localize_script('aargo-sr-admin', 'aargo_sr_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('aargo_sr_nonce')
        ));
    }
    
    public function settings_page() {
        $mcp_url = get_option('aargo_sr_mcp_url', 'http://localhost:3000');
        $mcp_token = get_option('aargo_sr_mcp_token', '');
        $webhook_secret = get_option('aargo_sr_webhook_secret', '');
        $auto_sync = get_option('aargo_sr_auto_sync', 'yes');
        $auto_ship = get_option('aargo_sr_auto_ship', 'no');
        $pickup_postcode = get_option('aargo_sr_pickup_postcode', '110001');
        
        // Test connection
        $connection_status = $this->test_connection();
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <div class="aargo-sr-status-card">
                <h2>Connection Status</h2>
                <?php if ($connection_status): ?>
                    <div class="notice notice-success">
                        <p>✅ Connected to MCP Server at <?php echo esc_html($mcp_url); ?></p>
                    </div>
                <?php else: ?>
                    <div class="notice notice-error">
                        <p>❌ Cannot connect to MCP Server at <?php echo esc_html($mcp_url); ?></p>
                        <p>Please check that the MCP server is running and the URL is correct.</p>
                    </div>
                <?php endif; ?>
            </div>
            
            <form method="post" action="options.php">
                <?php settings_fields('aargo_sr_settings'); ?>
                <?php do_settings_sections('aargo_sr_settings'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">MCP Server URL</th>
                        <td>
                            <input type="url" name="aargo_sr_mcp_url" 
                                   value="<?php echo esc_attr($mcp_url); ?>" 
                                   class="regular-text">
                            <p class="description">The URL of your Shiprocket MCP server (e.g., http://localhost:3000)</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">MCP Auth Token</th>
                        <td>
                            <input type="password" name="aargo_sr_mcp_token" 
                                   value="<?php echo esc_attr($mcp_token); ?>" 
                                   class="regular-text">
                            <p class="description">Authentication token for MCP server</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">Webhook Secret</th>
                        <td>
                            <input type="password" name="aargo_sr_webhook_secret" 
                                   value="<?php echo esc_attr($webhook_secret); ?>" 
                                   class="regular-text">
                            <p class="description">Secret key for verifying Shiprocket webhook signatures (optional but recommended)</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">Pickup Postcode</th>
                        <td>
                            <input type="text" name="aargo_sr_pickup_postcode" 
                                   value="<?php echo esc_attr($pickup_postcode); ?>" 
                                   class="regular-text">
                            <p class="description">Your warehouse/pickup location postcode</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">Auto Sync Orders</th>
                        <td>
                            <label>
                                <input type="checkbox" name="aargo_sr_auto_sync" 
                                       value="yes" <?php checked($auto_sync, 'yes'); ?>>
                                Automatically sync new orders to Shiprocket
                            </label>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">Auto Ship</th>
                        <td>
                            <label>
                                <input type="checkbox" name="aargo_sr_auto_ship" 
                                       value="yes" <?php checked($auto_ship, 'yes'); ?>>
                                Automatically ship orders after sync (selects cheapest courier)
                            </label>
                            <p class="description">⚠️ Enable only after testing sync functionality</p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button('Save Settings'); ?>
            </form>
            
            <div class="aargo-sr-info">
                <h2>Integration Info</h2>
                <table class="widefat">
                    <tr>
                        <td>Webhook URL</td>
                        <td><code><?php echo esc_html(Aargo_Shiprocket_Webhook::get_webhook_url()); ?></code></td>
                    </tr>
                    <tr>
                        <td>Tracking Page</td>
                        <td>
                            <?php if ($tracking_page = get_page_by_path('order-tracking')): ?>
                                <a href="<?php echo esc_url(get_permalink($tracking_page->ID)); ?>" target="_blank">
                                    <?php echo esc_url(get_permalink($tracking_page->ID)); ?>
                                </a>
                            <?php else: ?>
                                <em>Not created yet</em>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <td>Tracking Shortcode</td>
                        <td><code>[aargo_tracking]</code></td>
                    </tr>
                </table>
            </div>
            
            <div class="aargo-sr-tools">
                <h2>Quick Actions</h2>
                <button type="button" class="button" id="aargo-test-connection">
                    Test Connection
                </button>
                <button type="button" class="button" id="aargo-create-tracking-page">
                    Create Tracking Page
                </button>
            </div>
        </div>
        <?php
    }
    
    private function test_connection() {
        $client = new Aargo_Shiprocket_MCP_Client();
        return $client->health_check();
    }
    
    /**
     * AJAX test connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('aargo_sr_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permission denied');
        }
        
        $client = new Aargo_Shiprocket_MCP_Client();
        $connected = $client->health_check();
        
        if ($connected) {
            wp_send_json_success('Connected to MCP Server');
        } else {
            wp_send_json_error('Cannot connect to MCP Server. Please check URL and token.');
        }
    }
    
    /**
     * AJAX create tracking page
     */
    public function ajax_create_tracking_page() {
        check_ajax_referer('aargo_sr_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permission denied');
        }
        
        Aargo_Shiprocket_Tracking::create_tracking_page();
        
        $page = get_page_by_path('order-tracking');
        if ($page) {
            wp_send_json_success(array('url' => get_permalink($page->ID)));
        } else {
            wp_send_json_error('Failed to create tracking page');
        }
    }
}
