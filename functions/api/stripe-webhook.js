/**
 * Cloudflare Pages Function: Stripe Webhook Handler
 * 
 * POST /api/stripe-webhook
 * 
 * Handles Stripe webhook events and sends WhatsApp notifications
 * 
 * Environment Variables Required:
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret (whsec_...)
 * - WHATSAPP_TOKEN: Meta WhatsApp Cloud API access token
 * - WHATSAPP_PHONE_NUMBER_ID: Your WhatsApp phone number ID
 * - WHATSAPP_TO: Recipient phone number (5491157604074)
 */

export async function onRequestPost({ request, env }) {
    try {
        // Get webhook signature from headers
        const signature = request.headers.get('stripe-signature');
        
        if (!signature) {
            return new Response('No signature', { status: 400 });
        }

        // Get raw body
        const body = await request.text();

        // Verify webhook signature
        const event = await verifyStripeWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET);

        // Handle checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            // Extract metadata
            const metadata = session.metadata;
            const customerEmail = session.customer_details?.email || session.customer_email;
            
            // Calculate estimated ARS (using exchange rate of 1000)
            const exchangeRate = 1000;
            const totalArs = parseFloat(metadata.totalUsd) * exchangeRate;

            // Format WhatsApp message
            const message = `✅ NUEVA RESERVA HOSTEA

Propiedad: ${metadata.propertyName}
Fechas: ${metadata.checkIn} al ${metadata.checkOut}
Noches: ${metadata.nights}
Huéspedes: ${metadata.guests}

💰 Total: USD ${metadata.totalUsd}
💵 Estimado ARS: ${totalArs.toLocaleString('es-AR')}

📧 Email: ${customerEmail}
🔖 Session: ${session.id}

Estado: ✅ PAGADO`;

            // Send WhatsApp notification
            await sendWhatsAppMessage({
                token: env.WHATSAPP_TOKEN,
                phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
                to: env.WHATSAPP_TO || '5491157604074',
                message
            });

            console.log('Webhook processed successfully:', session.id);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

async function verifyStripeWebhook(payload, signature, secret) {
    if (!secret) {
        throw new Error('Webhook secret not configured');
    }

    // Extract timestamp and signatures
    const signatureParts = signature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        if (key === 't') acc.timestamp = value;
        if (key === 'v1') acc.signatures.push(value);
        return acc;
    }, { timestamp: null, signatures: [] });

    const { timestamp, signatures: sigs } = signatureParts;

    if (!timestamp || sigs.length === 0) {
        throw new Error('Invalid signature format');
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // Compute expected signature using HMAC SHA256
    const expectedSignature = await computeHmacSha256(signedPayload, secret);

    // Compare signatures (constant-time comparison would be better)
    const signatureMatches = sigs.some(sig => sig === expectedSignature);

    if (!signatureMatches) {
        throw new Error('Invalid signature');
    }

    // Check timestamp (prevent replay attacks - allow 5 min tolerance)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) {
        throw new Error('Timestamp too old');
    }

    // Parse and return event
    return JSON.parse(payload);
}

async function computeHmacSha256(data, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);

    // Import key
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign data
    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to hex string
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function sendWhatsAppMessage({ token, phoneNumberId, to, message }) {
    if (!token || !phoneNumberId) {
        throw new Error('WhatsApp credentials not configured');
    }

    // Meta WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
            body: message
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`WhatsApp API error: ${error}`);
    }

    return await response.json();
}