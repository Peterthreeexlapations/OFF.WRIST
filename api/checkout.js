// OFF.WRIST — Stripe Checkout Session
// POST /api/checkout  { items: [{ price_id, qty }] }  → { url }
import Stripe from 'stripe';

const sk = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(sk, {
  maxNetworkRetries: 0,
  timeout: 8000,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!sk) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY env var is missing on Vercel' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items' });

    const line_items = items
      .filter((i) => i && i.price_id)
      .map((i) => ({ price: i.price_id, quantity: Math.max(1, parseInt(i.qty, 10) || 1) }));

    if (!line_items.length) return res.status(400).json({ error: 'No valid line items' });

    const origin =
      req.headers.origin ||
      (req.headers['x-forwarded-host']
        ? `https://${req.headers['x-forwarded-host']}`
        : `https://${req.headers.host}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU'] },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', {
      name: err?.name,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      message: err?.message,
      param: err?.param,
    });
    return res.status(500).json({
      error: err?.message || 'Checkout failed',
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
    });
  }
}
