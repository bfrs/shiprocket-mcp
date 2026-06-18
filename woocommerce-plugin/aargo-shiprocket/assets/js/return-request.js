jQuery(document).ready(function($) {
    var $form = $('#aargo-return-form');
    var $success = $('#return-success');
    var $error = $('#return-error');
    var $loading = $('#return-loading');
    var ajaxUrl = (window.aargo_tracking_ajax && aargo_tracking_ajax.return_ajax_url) || '/wp-admin/admin-ajax.php';
    var nonce = (window.aargo_tracking_ajax && aargo_tracking_ajax.return_nonce) || '';

    $form.on('submit', function(e) {
        e.preventDefault();

        var orderId = $('#return-order-id').val().trim();
        var email = $('#return-email').val().trim();
        var reasonCategory = $('#return-reason-select').val();
        var reason = $('#return-comments').val().trim();
        var returnType = $('#return-type').val();

        if (!orderId || !email || !reason || !reasonCategory) {
            showError('Please fill in all required fields.');
            return;
        }

        $success.hide();
        $error.hide();
        $loading.show();

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: {
                action: 'aargo_submit_return',
                nonce: nonce,
                order_id: orderId,
                email: email,
                reason_category: reasonCategory,
                reason: reason,
                return_type: returnType
            },
            success: function(response) {
                $loading.hide();
                if (response && response.success && response.data) {
                    var data = response.data;
                    $('#return-id').text(data.return_id || 'Pending');
                    $('#return-result-order-id').text(orderId);
                    $('#return-type-display').text(returnType === 'exchange' ? 'Exchange' : 'Return & Refund');
                    $success.show();
                    $('html, body').animate({ scrollTop: $success.offset().top - 50 }, 500);
                } else {
                    showError((response && response.data) ? String(response.data) : 'Unable to submit your return request.');
                }
            },
            error: function() {
                $loading.hide();
                showError('Network error. Please try again later.');
            }
        });
    });

    function showError(message) {
        $('#return-error-message').text(message);
        $error.show();
        $('html, body').animate({ scrollTop: $error.offset().top - 50 }, 500);
    }
});
