/**
 * Cloudflare Pages Function: Create Stripe Checkout Session
 * 
 * POST /api/create-checkout-session
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Your Stripe test secret key (sk_test_...)
 * - SITE_URL: Your site URL (e.g., https://hostea.pages.dev)
 */

export async function onRequestPost({ request, env }) {
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    try {
        // Parse request body
        const body = await request.json();
        const {
            propertyId,
            propertyName,
            checkIn,
            checkOut,
            guests,
            customerEmail,
            totalUsd,
            nights
        } = body;

        // Validate required fields
        if (!propertyId || !propertyName || !checkIn || !checkOut || !guests || !customerEmail || !totalUsd) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers }
            );
        }

        // Get environment variables
        const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
        const SITE_URL = env.SITE_URL || 'https://hostea.pages.dev';

        if (!STRIPE_SECRET_KEY) {
            return new Response(
                JSON.stringify({ error: 'Stripe not configured' }),
                { status: 500, headers }
            );
        }

        // Create Stripe Checkout Session
        const session = await createStripeCheckoutSession({
            stripeKey: STRIPE_SECRET_KEY,
            propertyId,
            propertyName,
            checkIn,
            checkOut,
            guests,
            customerEmail,
            totalUsd,
            nights,
            siteUrl: SITE_URL
        });

        return new Response(
            JSON.stringify({ url: session.url }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Checkout session error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers }
        );
    }
}

async function createStripeCheckoutSession({
    stripeKey,
    propertyId,
    propertyName,
    checkIn,
    checkOut,
    guests,
    customerEmail,
    totalUsd,
    nights,
    siteUrl
}) {
    // Stripe API endpoint
    const url = 'https://api.stripe.com/v1/checkout/sessions';

    // Calculate amount in cents
    const amountCents = Math.round(totalUsd * 100);

    // Prepare form data
    const formData = new URLSearchParams({
        'payment_method_types[]': 'card',
        'mode': 'payment',
        'customer_email': customerEmail,
        'success_url': `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${siteUrl}/cancel.html`,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `${propertyName} - ${nights} ${nights === 1 ? 'noche' : 'noches'}`,
        'line_items[0][price_data][product_data][description]': `Check-in: ${checkIn} | Check-out: ${checkOut} | Huéspedes: ${guests}`,
        'line_items[0][price_data][unit_amount]': amountCents,
        'line_items[0][quantity]': 1,
        'metadata[propertyId]': propertyId,
        'metadata[propertyName]': propertyName,
        'metadata[checkIn]': checkIn,
        'metadata[checkOut]': checkOut,
        'metadata[guests]': guests,
        'metadata[totalUsd]': totalUsd,
        'metadata[nights]': nights
    });

    // Make request to Stripe
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe API error: ${error}`);
    }

    return await response.json();
}