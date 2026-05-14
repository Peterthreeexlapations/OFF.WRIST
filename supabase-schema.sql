-- OFF.WRIST — Supabase schema
-- Run this once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  name                 text not null,
  description          text,
  price_cents          integer not null check (price_cents >= 0),
  currency             text not null default 'usd',
  color                text,
  image_url            text,                    -- main image (Supabase Storage public URL)
  image_urls           jsonb not null default '[]'::jsonb,  -- gallery
  stripe_payment_link  text,                    -- paste from Stripe → Payment Links
  in_stock             boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

-- Public read access. Writes only via the service role key (server-side).
alter table products enable row level security;

drop policy if exists "Public can read in-stock products" on products;
create policy "Public can read in-stock products"
  on products for select
  using (true);

-- Helpful index
create index if not exists products_sort_idx on products (sort_order);

-- ---- Sample seed (delete or edit before launch) ----
-- insert into products (slug, name, description, price_cents, color, sort_order)
-- values
--   ('octagon-case-purple', 'Octagon Case — Royal Purple', 'Matte purple conversion case with integrated strap.', 18900, 'Royal Purple', 1),
--   ('octagon-case-black',  'Octagon Case — Stealth Black', 'All-black matte conversion case.',                  18900, 'Stealth Black', 2),
--   ('octagon-case-white',  'Octagon Case — Arctic White',  'Matte white case with integrated white strap.',     18900, 'Arctic White', 3);

-- ---- Storage bucket ----
-- 1) In Supabase Dashboard → Storage → New bucket: name = "product-images", public = ON
-- 2) Upload images, copy each public URL into products.image_url (or image_urls jsonb array).
