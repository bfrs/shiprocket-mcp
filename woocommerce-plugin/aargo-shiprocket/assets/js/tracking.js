jQuery(document).ready(function($) {
    var $form = $('#aargo-tracking-form');
    var $results = $('#tracking-results');
    var $error = $('#tracking-error');
    var $loading = $('#tracking-loading');
    
    $form.on('submit', function(e) {
        e.preventDefault();
        
        var orderId = $('#tracking-order-id').val().trim();
        var email = $('#tracking-email').val().trim();
        
        if (!orderId && !email) {
            alert('Please enter an order ID or email address.');
            return;
        }
        
        // Show loading, hide results/error
        $results.hide();
        $error.hide();
        $loading.show();
        
        $.ajax({
            url: aargo_tracking_ajax.ajax_url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                order_id: orderId,
                email: email
            }),
            headers: {
                'X-WP-Nonce': aargo_tracking_ajax.nonce
            },
            success: function(response) {
                $loading.hide();
                
                if (response.success && response.data) {
                    displayResults(response.data);
                } else {
                    showError();
                }
            },
            error: function(xhr) {
                $loading.hide();
                
                if (xhr.status === 404) {
                    showError();
                } else {
                    alert('Error loading tracking information. Please try again.');
                }
            }
        });
    });
    
    function displayResults(data) {
        $('#result-order-id').text(data.order_id || 'N/A');
        $('#result-awb').text(data.awb || 'N/A');
        $('#result-courier').text(data.courier || 'N/A');
        $('#result-edd').text(data.expected_delivery || 'N/A');
        
        // Update status badge
        var $status = $('#tracking-status');
        $status.text(data.status || 'Processing');
        $status.attr('class', 'tracking-status ' + (data.status || '').toLowerCase().replace(/\s+/g, '-'));
        
        // Build timeline
        var $timeline = $('#timeline-container');
        $timeline.empty();
        
        if (data.timeline && data.timeline.length > 0) {
            data.timeline.forEach(function(item) {
                var html = '<div class="timeline-item">';
                html += '<div class="timeline-content">';
                html += '<div class="timeline-status">' + (item.status || 'Updated') + '</div>';
                html += '<div class="timeline-location">' + (item.location || 'N/A') + '</div>';
                html += '<div class="timeline-date">' + (item.date || '') + ' ' + (item.time || '') + '</div>';
                html += '</div>';
                html += '</div>';
                
                $timeline.append(html);
            });
        } else {
            $timeline.html('<p>No tracking updates yet.</p>');
        }
        
        // Update external tracking link
        if (data.tracking_url) {
            $('#tracking-url').attr('href', data.tracking_url).show();
        } else {
            $('#tracking-url').hide();
        }
        
        $results.show();
        
        // Scroll to results
        $('html, body').animate({
            scrollTop: $results.offset().top - 50
        }, 500);
    }
    
    function showError() {
        $error.show();
        
        $('html, body').animate({
            scrollTop: $error.offset().top - 50
        }, 500);
    }
});
