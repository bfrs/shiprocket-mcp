<?php
/**
 * Customer Return Request Page
 * Matches the style of the tracking page.
 */
?>
<div class="aargo-tracking-container aargo-return-container">
    <div class="aargo-tracking-form aargo-return-form">
        <h2>Request a Return or Exchange</h2>
        <p>Enter your order details and tell us why you'd like to return an item. We'll get back to you within 24 hours.</p>

        <form id="aargo-return-form">
            <div class="form-group">
                <label for="return-type">Request Type</label>
                <select id="return-type" name="return_type" class="form-control">
                    <option value="return">Return &amp; Refund</option>
                    <option value="exchange">Exchange for Another Item</option>
                </select>
            </div>

            <div class="form-group">
                <label for="return-order-id">Order ID <span class="required">*</span></label>
                <input type="text" id="return-order-id" name="order_id" placeholder="e.g., 12345" required>
            </div>

            <div class="form-group">
                <label for="return-email">Email Address <span class="required">*</span></label>
                <input type="email" id="return-email" name="email" placeholder="your@email.com" required>
            </div>

            <div class="form-group">
                <label for="return-reason">Reason for Return <span class="required">*</span></label>
                <select id="return-reason-select" name="reason_category" class="form-control">
                    <option value="">-- Select a reason --</option>
                    <option value="damaged">Item arrived damaged</option>
                    <option value="wrong_item">Wrong item received</option>
                    <option value="size_issue">Size or fit issue</option>
                    <option value="quality">Quality not as expected</option>
                    <option value="not_as_described">Item not as described</option>
                    <option value="changed_mind">Changed my mind</option>
                    <option value="late_delivery">Late delivery</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <div class="form-group">
                <label for="return-comments">Additional Details <span class="required">*</span></label>
                <textarea id="return-comments" name="reason" rows="4" placeholder="Please describe the issue with your order..." required></textarea>
            </div>

            <button type="submit" class="btn-track btn-return">Submit Return Request</button>
        </form>
    </div>

    <div class="aargo-tracking-results aargo-return-success" id="return-success" style="display: none;">
        <div class="tracking-header">
            <h3>Return Request Submitted</h3>
            <div class="tracking-status delivered">Confirmed</div>
        </div>

        <div class="tracking-info">
            <div class="info-row">
                <span class="label">Return ID:</span>
                <span id="return-id"></span>
            </div>
            <div class="info-row">
                <span class="label">Order ID:</span>
                <span id="return-result-order-id"></span>
            </div>
            <div class="info-row">
                <span class="label">Request Type:</span>
                <span id="return-type-display"></span>
            </div>
            <div class="info-row">
                <span class="label">Next Step:</span>
                <span>Our team will review your request within 24 hours and email you pickup / drop-off instructions.</span>
            </div>
        </div>
    </div>

    <div class="aargo-tracking-error" id="return-error" style="display: none;">
        <p id="return-error-message">Unable to submit your return request. Please verify your details and try again.</p>
    </div>

    <div class="aargo-tracking-loading" id="return-loading" style="display: none;">
        <p>Submitting your return request...</p>
    </div>
</div>
