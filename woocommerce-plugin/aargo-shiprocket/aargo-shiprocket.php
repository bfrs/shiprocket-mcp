<?php
/**
 * Plugin Name: Aargo Shiprocket Integration
 * Description: Integrates WooCommerce with Shiprocket via MCP Server for automated shipping, tracking, and order management
 * Version: 1.1.0
 * Author: Aargo Lifestyle
 * Text Domain: aargo-shiprocket
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// Define constants
define('AARGO_SR_VERSION', '1.1.0');
define('AARGO_SR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('AARGO_SR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'Aargo_Shiprocket_';
    $base_dir = AARGO_SR_PLUGIN_DIR . 'includes/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . 'class-' . str_replace('_', '-', strtolower($relative_class)) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// Activation hook
register_activation_hook(__FILE__, 'aargo_shiprocket_activate');
function aargo_shiprocket_activate() {
    require_once AARGO_SR_PLUGIN_DIR . 'includes/class-db.php';
    Aargo_Shiprocket_DB::create_tables();
    
    // Set default options
    add_option('aargo_sr_mcp_url', 'http://localhost:3000');
    add_option('aargo_sr_mcp_token', '');
    add_option('aargo_sr_auto_ship', 'no');
    add_option('aargo_sr_auto_sync', 'yes');
    
    flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'aargo_shiprocket_deactivate');
function aargo_shiprocket_deactivate() {
    flush_rewrite_rules();
}

// Initialize plugin
add_action('plugins_loaded', 'aargo_shiprocket_init');
function aargo_shiprocket_init() {
    // Check WooCommerce is active
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'aargo_shiprocket_wc_missing_notice');
        return;
    }

    // Core classes (Option A)
    new Aargo_Shiprocket_Admin();
    new Aargo_Shiprocket_Order_Sync();
    new Aargo_Shiprocket_Tracking();
    new Aargo_Shiprocket_Webhook();

    // Option B classes
    new Aargo_Shiprocket_Smart_Courier();
    new Aargo_Shiprocket_NDR_Automation();

    // Option C classes (Full Automation)
    new Aargo_Shiprocket_Bulk_Operations();
    new Aargo_Shiprocket_Analytics();
    new Aargo_Shiprocket_Returns();

    // Register REST API endpoints
    add_action('rest_api_init', 'aargo_shiprocket_register_routes');
}

function aargo_shiprocket_wc_missing_notice() {
    echo '<div class="notice notice-error"><p>' . 
         esc_html__('Aargo Shiprocket requires WooCommerce to be installed and active.', 'aargo-shiprocket') . 
         '</p></div>';
}

function aargo_shiprocket_register_routes() {
    register_rest_route('aargo/v1', '/shiprocket-webhook', array(
        'methods' => 'POST',
        'callback' => 'aargo_shiprocket_handle_webhook',
        'permission_callback' => '__return_true'
    ));
    
    register_rest_route('aargo/v1', '/track-order', array(
        'methods' => 'POST',
        'callback' => 'aargo_shiprocket_track_order',
        'permission_callback' => '__return_true'
    ));
}

function aargo_shiprocket_handle_webhook($request) {
    $data = $request->get_json_params();
    $webhook = new Aargo_Shiprocket_Webhook();
    return $webhook->process($data);
}

function aargo_shiprocket_track_order($request) {
    $data = $request->get_json_params();
    $tracking = new Aargo_Shiprocket_Tracking();
    return $tracking->get_order_tracking($data);
}

// Add settings link on plugins page
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'aargo_shiprocket_action_links');
function aargo_shiprocket_action_links($links) {
    $settings_link = '<a href="' . admin_url('admin.php?page=aargo-shiprocket') . '">' . 
                     __('Settings', 'aargo-shiprocket') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}

// Add order meta box
add_action('add_meta_boxes', 'aargo_shiprocket_order_meta_box');
function aargo_shiprocket_order_meta_box() {
    add_meta_box(
        'aargo_shiprocket_status',
        __('Shiprocket Status', 'aargo-shiprocket'),
        'aargo_shiprocket_order_meta_box_callback',
        'shop_order',
        'side',
        'high'
    );
}

function aargo_shiprocket_order_meta_box_callback($post) {
    $order = wc_get_order($post->ID);
    $sr_order_id = $order->get_meta('_shiprocket_order_id');
    $awb = $order->get_meta('_awb_number');
    $courier = $order->get_meta('_courier_name');
    $status = $order->get_meta('_shiprocket_status');
    $label_url = $order->get_meta('_label_url');
    ?>
    <div class="aargo-sr-meta-box">
        <?php if ($sr_order_id): ?>
            <p><strong>Shiprocket Order:</strong> <?php echo esc_html($sr_order_id); ?></p>
        <?php endif; ?>
        <?php if ($awb): ?>
            <p><strong>AWB:</strong> <?php echo esc_html($awb); ?></p>
        <?php endif; ?>
        <?php if ($courier): ?>
            <p><strong>Courier:</strong> <?php echo esc_html($courier); ?></p>
        <?php endif; ?>
        <?php if ($status): ?>
            <p><strong>Status:</strong> <?php echo esc_html($status); ?></p>
        <?php endif; ?>
        <?php if ($label_url): ?>
            <p><a href="<?php echo esc_url($label_url); ?>" target="_blank" class="button">Download Label</a></p>
        <?php endif; ?>
        
        <?php if (!$sr_order_id): ?>
            <button type="button" class="button" id="aargo-sync-order" data-order-id="<?php echo esc_attr($post->ID); ?>">
                Sync to Shiprocket
            </button>
        <?php endif; ?>
    </div>
    <?php
}

// Enqueue admin scripts
add_action('admin_enqueue_scripts', 'aargo_shiprocket_admin_scripts');
function aargo_shiprocket_admin_scripts($hook) {
    if ($hook !== 'woocommerce_page_wc-orders' && $hook !== 'post.php') {
        return;
    }
    
    wp_enqueue_style('aargo-sr-admin', AARGO_SR_PLUGIN_URL . 'assets/css/admin.css', array(), AARGO_SR_VERSION);
    wp_enqueue_script('aargo-sr-admin', AARGO_SR_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), AARGO_SR_VERSION, true);
    wp_localize_script('aargo-sr-admin', 'aargo_sr_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('aargo_sr_nonce')
    ));
}

// Register shortcode
add_shortcode('aargo_tracking', 'aargo_shiprocket_tracking_shortcode');
function aargo_shiprocket_tracking_shortcode($atts) {
    ob_start();
    include AARGO_SR_PLUGIN_DIR . 'public/tracking-page.php';
    return ob_get_clean();
}

// Register return request shortcode
add_shortcode('aargo_return_request', 'aargo_shiprocket_return_request_shortcode');
function aargo_shiprocket_return_request_shortcode($atts) {
    ob_start();
    include AARGO_SR_PLUGIN_DIR . 'public/return-request.php';
    return ob_get_clean();
}

// Enqueue public assets (tracking + return) on pages containing the shortcodes
add_action('wp_enqueue_scripts', 'aargo_shiprocket_public_assets');
function aargo_shiprocket_public_assets() {
    global $post;
    if (is_a($post, 'WP_Post') && (has_shortcode($post->post_content, 'aargo_tracking') || has_shortcode($post->post_content, 'aargo_return_request'))) {
        wp_enqueue_style('aargo-sr-tracking', AARGO_SR_PLUGIN_URL . 'assets/css/tracking.css', array(), AARGO_SR_VERSION);
        wp_enqueue_script('aargo-sr-tracking', AARGO_SR_PLUGIN_URL . 'assets/js/tracking.js', array('jquery'), AARGO_SR_VERSION, true);
        wp_enqueue_script('aargo-sr-return', AARGO_SR_PLUGIN_URL . 'assets/js/return-request.js', array('jquery'), AARGO_SR_VERSION, true);
        wp_localize_script('aargo-sr-tracking', 'aargo_tracking_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'return_ajax_url' => admin_url('admin-ajax.php'),
            'return_nonce' => wp_create_nonce('aargo_return_nonce'),
            'nonce' => wp_create_nonce('aargo_sr_nonce')
        ));
    }
}
