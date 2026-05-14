// OFF.WRIST — runtime config
// Fill these in with your real keys. Do NOT commit real keys to git.
// Supabase anon key is safe to expose (it's public, RLS protects data).
// Stripe publishable key is also safe to expose. Secret keys go on server only.

window.OW_CONFIG = {
  SUPABASE_URL: 'https://onptfxecakfyhteigbju.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ucHRmeGVjYWtmeWh0ZWlnYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MjA4NjIsImV4cCI6MjA5NDI5Njg2Mn0.1J_GcxPnAcgeRWS53AJSSGPKrygGFc2UoYlF3f_adBE',

  // Stripe publishable key (only needed if using Stripe.js directly).
  // For the simplest setup, each product row stores its own Stripe Payment Link URL,
  // and we just open that URL on checkout — no publishable key required.
  STRIPE_PUBLISHABLE_KEY: '',

  // If true, app falls back to local sample products when Supabase isn't configured.
  USE_SAMPLE_PRODUCTS_IF_UNCONFIGURED: true,
};
