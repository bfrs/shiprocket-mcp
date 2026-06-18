<?php
/**
 * Customer Tracking Page
 */
?>
<div class="aargo-tracking-container">
    <div class="aargo-tracking-form">
        <h2>Track Your Order</h2>
        <p>Enter your order ID or email to check the status of your shipment.</p>
        
        <form id="aargo-tracking-form">
            <div class="form-group">
                <label for="tracking-order-id">Order ID</label>
                <input type="text" id="tracking-order-id" name="order_id" placeholder="e.g., 12345">
            </div>
            
            <div class="form-group">
                <label for="tracking-email">Email Address</label>
                <input type="email" id="tracking-email" name="email" placeholder="your@email.com">
            </div>
            
            <button type="submit" class="btn-track">Track Order</button>
        </form>
    </div>
    
    <div class="aargo-tracking-results" id="tracking-results" style="display: none;">
        <div class="tracking-header">
            <h3>Order #<span id="result-order-id"></span></h3>
            <div class="tracking-status" id="tracking-status"></div>
        </div>
        
        <div class="tracking-info">
            <div class="info-row">
                <span class="label">AWB Number:</span>
                <span id="result-awb"></span>
            </div>
            <div class="info-row">
                <span class="label">Courier:</span>
                <span id="result-courier"></span>
            </div>
            <div class="info-row">
                <span class="label">Expected Delivery:</span>
                <span id="result-edd"></span>
            </div>
        </div>
        
        <div class="tracking-timeline">
            <h4>Shipment Timeline</h4>
            <div id="timeline-container"></div>
        </div>
        
        <div class="tracking-actions">
            <a href="#" id="tracking-url" target="_blank" class="btn-track-external">
                Track on Courier Website
            </a>
        </div>
    </div>
    
    <div class="aargo-tracking-error" id="tracking-error" style="display: none;">
        <p>Unable to find your order. Please check your order ID or email and try again.</p>
    </div>
    
    <div class="aargo-tracking-loading" id="tracking-loading" style="display: none;">
        <p>Loading tracking information...</p>
    </div>
</div>
