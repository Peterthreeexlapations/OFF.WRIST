// OFF.WRIST — Square Quick Pay Checkout
// POST /api/checkout-square  { items: [{ slug, qty }] }  → { url }
// Fetches product details from Supabase server-side so prices can't be tampered.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SQUARE_BASE = 'https://connect.squareup.com';
const SQUARE_VERSION = '2025-01-23';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_ANON_KEY;

  if (!token || !locationId) {
    return res.status(500).json({ error: 'Square credentials missing on Vercel' });
  }
  if (!supaUrl || !supaKey) {
    return res.status(500).json({ error: 'Supabase credentials missing on Vercel' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items' });

    const supabase = createClient(supaUrl, supaKey);
    const slugs = items.map((i) => i?.slug).filter(Boolean);
    const { data: products, error } = await supabase
      .from('products')
      .select('slug, name, price_cents, currency')
      .in('slug', slugs);

    if (error) return res.status(500).json({ error: `Supabase: ${error.message}` });

    const bySlug = Object.fromEntries((products || []).map((p) => [p.slug, p]));
    const line_items = items
      .map((i) => {
        const p = bySlug[i.slug];
        if (!p) return null;
        const qty = Math.max(1, parseInt(i.qty, 10) || 1);
        return {
          name: p.name,
          quantity: String(qty),
          base_price_money: {
            amount: p.price_cents,
            currency: (p.currency || 'usd').toUpperCase(),
          },
        };
      })
      .filter(Boolean);

    if (!line_items.length) return res.status(400).json({ error: 'No valid items' });

    const origin =
      req.headers.origin ||
      (req.headers['x-forwarded-host']
        ? `https://${req.headers['x-forwarded-host']}`
        : `https://${req.headers.host}`);

    const sqRes = await fetch(`${SQUARE_BASE}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Square-Version': SQUARE_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        order: {
          location_id: locationId,
          line_items,
        },
        checkout_options: {
          redirect_url: `${origin}/?checkout=success`,
          allow_tipping: false,
          ask_for_shipping_address: true,
          accepted_payment_methods: {
            apple_pay: true,
            google_pay: true,
            cash_app_pay: true,
            afterpay_clearpay: false,
          },
        },
        pre_populated_data: {},
      }),
    });

    const data = await sqRes.json();
    if (!sqRes.ok || !data?.payment_link?.url) {
      const errDetail = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || 'Square checkout failed';
      console.error('Square error:', data);
      return res.status(500).json({ error: errDetail, square: data });
    }

    return res.status(200).json({ url: data.payment_link.url });
  } catch (err) {
    console.error('Checkout-square error:', err);
    return res.status(500).json({ error: err?.message || 'Checkout failed' });
  }
}
