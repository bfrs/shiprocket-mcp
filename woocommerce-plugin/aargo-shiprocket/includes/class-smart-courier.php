<?php
/**
 * Smart Courier - AI-optimized courier selection
 */

class Aargo_Shiprocket_Smart_Courier {
    
    private $courier_scores = array();
    
    public function __construct() {
        // Initialize courier performance data
        $this->load_courier_history();
    }
    
    /**
     * Select best courier based on multiple criteria
     */
    public function select_courier($order_id, $criteria = array()) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return null;
        }
        
        $pickup_postcode = get_option('aargo_sr_pickup_postcode', '110001');
        $delivery_postcode = $order->get_billing_postcode();
        $weight = $this->get_order_weight($order);
        $cod_or_prepaid = $order->get_payment_method() === 'cod' ? 'COD' : 'PREPAID';
        
        $client = new Aargo_Shiprocket_MCP_Client();
        $result = $client->get_rates($pickup_postcode, $delivery_postcode, $weight, $cod_or_prepaid);
        
        if (!$result['success'] || empty($result['data'])) {
            return null;
        }
        
        $couriers = $result['data'];
        
        // Score each courier
        $scored_couriers = array();
        foreach ($couriers as $courier) {
            $score = $this->score_courier($courier, $criteria, $delivery_postcode);
            $scored_couriers[] = array_merge($courier, array(
                'score' => $score,
                'reason' => $this->get_score_reason($score, $criteria)
            ));
        }
        
        // Sort by score (descending)
        usort($scored_couriers, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        return $scored_couriers[0];
    }
    
    /**
     * Score courier based on criteria
     */
    private function score_courier($courier, $criteria, $pincode) {
        $score = 100; // Base score
        
        // Price factor (30%)
        $price = floatval($courier['rate'] ?? 0);
        $max_price = $this->get_max_price($pincode);
        if ($max_price > 0) {
            $price_score = (1 - ($price / $max_price)) * 30;
            $score += $price_score;
        }
        
        // Speed factor (25%)
        $delivery_days = intval($courier['etd'] ?? 7);
        $speed_score = max(0, (7 - $delivery_days) / 7 * 25);
        $score += $speed_score;
        
        // Reliability factor (25%)
        $reliability = $this->get_courier_reliability($courier['courier_name']);
        $score += $reliability * 25;
        
        // COD support (10%)
        if ($courier['cod'] ?? false) {
            $score += 10;
        }
        
        // RTO rate (10%)
        $rto_rate = $this->get_courier_rto_rate($courier['courier_name']);
        $score += (1 - $rto_rate) * 10;
        
        // Apply user preferences
        if (!empty($criteria['preferred_courier'])) {
            if (stripos($courier['courier_name'], $criteria['preferred_courier']) !== false) {
                $score += 20; // Bonus for preferred courier
            }
        }
        
        if (!empty($criteria['max_price'])) {
            if ($price > $criteria['max_price']) {
                $score -= 50; // Heavy penalty
            }
        }
        
        if (!empty($criteria['speed_priority']) && $criteria['speed_priority']) {
            $score += $speed_score * 0.5; // Extra speed bonus
        }
        
        return round($score, 2);
    }
    
    /**
     * Get courier reliability score (0-1)
     */
    private function get_courier_reliability($courier_name) {
        $history = get_option('aargo_sr_courier_history', array());
        $courier_key = sanitize_key($courier_name);
        
        if (isset($history[$courier_key])) {
            $delivered = $history[$courier_key]['delivered'] ?? 0;
            $total = $history[$courier_key]['total'] ?? 0;
            
            if ($total > 0) {
                return $delivered / $total;
            }
        }
        
        // Default reliability based on known couriers
        $defaults = array(
            'delhivery' => 0.92,
            'ekart' => 0.88,
            'bluedart' => 0.95,
            'dtdc' => 0.85,
            'ecom' => 0.87,
            'fedex' => 0.93,
            'amazon' => 0.90,
        );
        
        foreach ($defaults as $key => $value) {
            if (stripos($courier_name, $key) !== false) {
                return $value;
            }
        }
        
        return 0.85; // Default
    }
    
    /**
     * Get courier RTO rate (0-1)
     */
    private function get_courier_rto_rate($courier_name) {
        $history = get_option('aargo_sr_courier_history', array());
        $courier_key = sanitize_key($courier_name);
        
        if (isset($history[$courier_key])) {
            $rto = $history[$courier_key]['rto'] ?? 0;
            $total = $history[$courier_key]['total'] ?? 0;
            
            if ($total > 0) {
                return $rto / $total;
            }
        }
        
        // Default RTO rates
        $defaults = array(
            'delhivery' => 0.08,
            'ekart' => 0.10,
            'bluedart' => 0.05,
            'dtdc' => 0.12,
            'ecom' => 0.11,
            'fedex' => 0.06,
        );
        
        foreach ($defaults as $key => $value) {
            if (stripos($courier_name, $key) !== false) {
                return $value;
            }
        }
        
        return 0.10; // Default
    }
    
    /**
     * Get max price for pincode
     */
    private function get_max_price($pincode) {
        // Could be cached or based on historical data
        return 1000; // Default max
    }
    
    /**
     * Get order weight
     */
    private function get_order_weight($order) {
        $total = 0;
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if ($product) {
                $total += floatval($product->get_weight()) * $item->get_quantity();
            }
        }
        return $total > 0 ? $total : 0.5;
    }
    
    /**
     * Get score reason
     */
    private function get_score_reason($score, $criteria) {
        if ($score > 150) {
            return 'Excellent choice - High reliability + Low cost';
        } elseif ($score > 130) {
            return 'Good choice - Balanced cost and speed';
        } elseif ($score > 110) {
            return 'Fair choice - Average performance';
        } else {
            return 'Limited options for this route';
        }
    }
    
    /**
     * Update courier history after delivery
     */
    public function update_courier_history($courier_name, $status) {
        $history = get_option('aargo_sr_courier_history', array());
        $key = sanitize_key($courier_name);
        
        if (!isset($history[$key])) {
            $history[$key] = array(
                'delivered' => 0,
                'rto' => 0,
                'ndr' => 0,
                'total' => 0
            );
        }
        
        $history[$key]['total']++;
        
        switch ($status) {
            case 'delivered':
                $history[$key]['delivered']++;
                break;
            case 'rto':
                $history[$key]['rto']++;
                break;
            case 'ndr':
                $history[$key]['ndr']++;
                break;
        }
        
        update_option('aargo_sr_courier_history', $history);
    }
    
    /**
     * Load courier history
     */
    private function load_courier_history() {
        // History is stored in WordPress options
        // No need to load here, accessed via get_option
    }
    
    /**
     * Get courier performance report
     */
    public function get_courier_report() {
        $history = get_option('aargo_sr_courier_history', array());
        $report = array();
        
        foreach ($history as $courier => $data) {
            $total = $data['total'] ?? 0;
            if ($total > 0) {
                $report[$courier] = array(
                    'total' => $total,
                    'delivered' => $data['delivered'] ?? 0,
                    'delivery_rate' => round(($data['delivered'] / $total) * 100, 2) . '%',
                    'rto_rate' => round(($data['rto'] / $total) * 100, 2) . '%',
                    'ndr_rate' => round(($data['ndr'] / $total) * 100, 2) . '%',
                );
            }
        }
        
        return $report;
    }
}
