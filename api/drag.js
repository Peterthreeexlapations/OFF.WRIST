// OFF.WRIST — diagnostic endpoint
// GET /api/diag → reports env + Stripe connectivity
import Stripe from 'stripe';

export default async function handler(req, res) {
  const sk = process.env.STRIPE_SECRET_KEY || '';
  const out = {
    has_secret_key: !!sk,
    key_prefix: sk ? sk.slice(0, 8) : null,
    key_length: sk.length,
    key_has_whitespace: sk !== sk.trim(),
    node_version: process.version,
    stripe_sdk_version: null,
    raw_fetch_test: null,
    stripe_sdk_test: null,
  };

  // 1. Read package version
  try {
    const pkg = await import('stripe/package.json', { assert: { type: 'json' } });
    out.stripe_sdk_version = pkg.default?.version;
  } catch {
    try {
      const pkg = (await import('stripe/package.json')).default;
      out.stripe_sdk_version = pkg?.version;
    } catch (e) {
      out.stripe_sdk_version = 'unknown: ' + e.message;
    }
  }

  // 2. Raw fetch test (bypasses Stripe SDK)
  try {
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${sk.trim()}` },
    });
    const json = await r.json();
    out.raw_fetch_test = {
      status: r.status,
      ok: r.ok,
      body: json.error ? { error: json.error.message } : { has_balance: !!json.available },
    };
  } catch (e) {
    out.raw_fetch_test = { error: e.message, name: e.name };
  }

  // 3. Stripe SDK test
  try {
    const stripe = new Stripe(sk, { maxNetworkRetries: 0, timeout: 8000 });
    const bal = await stripe.balance.retrieve();
    out.stripe_sdk_test = { ok: true, has_balance: !!bal.available };
  } catch (e) {
    out.stripe_sdk_test = {
      ok: false,
      name: e.name,
      type: e.type,
      code: e.code,
      message: e.message,
    };
  }

  res.status(200).json(out);
}
