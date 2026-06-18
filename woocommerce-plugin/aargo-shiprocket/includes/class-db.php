<?php
/**
 * Database - Create and manage custom tables
 */

class Aargo_Shiprocket_DB {
    
    public static function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        
        // Sync tracking table
        $table_sync = $wpdb->prefix . 'aargo_shiprocket_sync';
        $sql_sync = "CREATE TABLE IF NOT EXISTS $table_sync (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            wc_order_id bigint(20) unsigned NOT NULL,
            shiprocket_order_id varchar(100) DEFAULT NULL,
            awb_number varchar(100) DEFAULT NULL,
            courier_name varchar(100) DEFAULT NULL,
            status varchar(50) DEFAULT NULL,
            label_url varchar(500) DEFAULT NULL,
            manifest_url varchar(500) DEFAULT NULL,
            pickup_date date DEFAULT NULL,
            delivered_date date DEFAULT NULL,
            error_message text DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_wc_order (wc_order_id),
            KEY idx_awb (awb_number),
            KEY idx_status (status),
            KEY idx_sr_order (shiprocket_order_id)
        ) $charset_collate;";
        
        // NDR tracking table
        $table_ndr = $wpdb->prefix . 'aargo_shiprocket_ndr';
        $sql_ndr = "CREATE TABLE IF NOT EXISTS $table_ndr (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            wc_order_id bigint(20) unsigned NOT NULL,
            awb_number varchar(100) DEFAULT NULL,
            ndr_code varchar(50) DEFAULT NULL,
            ndr_reason text DEFAULT NULL,
            action_taken varchar(50) DEFAULT NULL,
            resolved tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_wc_order (wc_order_id),
            KEY idx_awb (awb_number)
        ) $charset_collate;";
        
        // Returns table
        $table_returns = $wpdb->prefix . 'aargo_shiprocket_returns';
        $sql_returns = "CREATE TABLE IF NOT EXISTS $table_returns (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            wc_order_id bigint(20) unsigned NOT NULL,
            shiprocket_return_id varchar(100) DEFAULT NULL,
            return_type enum('return', 'exchange') DEFAULT 'return',
            status varchar(50) DEFAULT NULL,
            reason text DEFAULT NULL,
            reason_category varchar(50) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_wc_order (wc_order_id)
        ) $charset_collate;";
        
        // Webhook log table
        $table_webhook = $wpdb->prefix . 'aargo_shiprocket_webhooks';
        $sql_webhook = "CREATE TABLE IF NOT EXISTS $table_webhook (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_type varchar(100) DEFAULT NULL,
            payload longtext DEFAULT NULL,
            processed tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_event (event_type),
            KEY idx_processed (processed)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql_sync);
        dbDelta($sql_ndr);
        dbDelta($sql_returns);
        dbDelta($sql_webhook);
    }
    
    public static function drop_tables() {
        global $wpdb;
        
        $tables = array(
            $wpdb->prefix . 'aargo_shiprocket_sync',
            $wpdb->prefix . 'aargo_shiprocket_ndr',
            $wpdb->prefix . 'aargo_shiprocket_returns',
            $wpdb->prefix . 'aargo_shiprocket_webhooks'
        );
        
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS $table");
        }
    }
    
    public static function get_sync_record($wc_order_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'aargo_shiprocket_sync';
        
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE wc_order_id = %d ORDER BY id DESC LIMIT 1",
            $wc_order_id
        ));
    }
    
    public static function update_sync_record($wc_order_id, $data) {
        global $wpdb;
        $table = $wpdb->prefix . 'aargo_shiprocket_sync';
        
        $wpdb->update($table, $data, array('wc_order_id' => $wc_order_id));
    }
    
    public static function log_webhook($event_type, $payload) {
        global $wpdb;
        $table = $wpdb->prefix . 'aargo_shiprocket_webhooks';
        
        $wpdb->insert($table, array(
            'event_type' => $event_type,
            'payload' => json_encode($payload),
            'created_at' => current_time('mysql')
        ));
        
        return $wpdb->insert_id;
    }
}
