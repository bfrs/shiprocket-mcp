jQuery(document).ready(function($) {
    // Sync order button
    $('#aargo-sync-order').on('click', function() {
        var button = $(this);
        var orderId = button.data('order-id');
        
        button.prop('disabled', true).text('Syncing...');
        
        $.ajax({
            url: aargo_sr_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'aargo_sync_order',
                order_id: orderId,
                nonce: aargo_sr_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    button.text('Synced!');
                    location.reload();
                } else {
                    button.text('Sync Failed');
                    alert(response.data || 'Sync failed. Please try again.');
                }
            },
            error: function() {
                button.text('Sync Failed');
                alert('Network error. Please try again.');
            },
            complete: function() {
                setTimeout(function() {
                    button.prop('disabled', false).text('Sync to Shiprocket');
                }, 3000);
            }
        });
    });
    
    // Test connection button
    $('#aargo-test-connection').on('click', function() {
        var button = $(this);
        button.prop('disabled', true).text('Testing...');
        
        $.ajax({
            url: aargo_sr_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'aargo_test_connection',
                nonce: aargo_sr_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('✅ Connected to MCP Server successfully!');
                } else {
                    alert('❌ Connection failed: ' + (response.data || 'Unknown error'));
                }
            },
            error: function() {
                alert('❌ Network error. Please check MCP server URL.');
            },
            complete: function() {
                button.prop('disabled', false).text('Test Connection');
            }
        });
    });
    
    // Create tracking page
    $('#aargo-create-tracking-page').on('click', function() {
        var button = $(this);
        button.prop('disabled', true).text('Creating...');
        
        $.ajax({
            url: aargo_sr_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'aargo_create_tracking_page',
                nonce: aargo_sr_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('✅ Tracking page created successfully!');
                    location.reload();
                } else {
                    alert('❌ Failed: ' + (response.data || 'Unknown error'));
                }
            },
            error: function() {
                alert('❌ Network error.');
            },
            complete: function() {
                button.prop('disabled', false).text('Create Tracking Page');
            }
        });
    });
});
