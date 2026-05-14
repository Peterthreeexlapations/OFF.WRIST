// OFF.WRIST — storefront logic
// - Loads products from Supabase (table: products)
// - Local cart in localStorage
// - Checkout: opens each line item's stripe_payment_link
//   (simplest static-site Stripe flow — no backend required)

(function () {
  const cfg = window.OW_CONFIG || {};
  const supaConfigured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR-SUPABASE');

  const supa = supaConfigured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  // -- Sample products (used when Supabase isn't configured yet) --
  const SAMPLE = [
    {
      id: 'sample-1',
      slug: 'octagon-case-purple',
      name: 'Octagon Case — Royal Purple',
      description: 'Matte purple aftermarket conversion case with integrated strap. Houses your collectible watch head in a sport-watch silhouette.',
      price_cents: 18900,
      currency: 'usd',
      color: 'Royal Purple',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
    {
      id: 'sample-2',
      slug: 'octagon-case-black',
      name: 'Octagon Case — Stealth Black',
      description: 'All-black matte conversion case. The cleanest way to put your pocket piece on your wrist.',
      price_cents: 18900,
      currency: 'usd',
      color: 'Stealth Black',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
    {
      id: 'sample-3',
      slug: 'octagon-case-white',
      name: 'Octagon Case — Arctic White',
      description: 'Bright matte white case with integrated white strap. High-contrast collector statement.',
      price_cents: 18900,
      currency: 'usd',
      color: 'Arctic White',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
    {
      id: 'sample-4',
      slug: 'integrated-strap-teal',
      name: 'Integrated Strap — Teal',
      description: 'Replacement integrated strap in teal. Tool-free swap.',
      price_cents: 4900,
      currency: 'usd',
      color: 'Teal',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
    {
      id: 'sample-5',
      slug: 'integrated-strap-yellow',
      name: 'Integrated Strap — Hyper Yellow',
      description: 'High-vis yellow integrated strap. Designed for collectors. Made for the culture.',
      price_cents: 4900,
      currency: 'usd',
      color: 'Hyper Yellow',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
    {
      id: 'sample-6',
      slug: 'octagon-case-sky',
      name: 'Octagon Case — Sky Blue',
      description: 'Sky blue matte case. Lightweight, hollow-center build with crown above the bezel.',
      price_cents: 18900,
      currency: 'usd',
      color: 'Sky Blue',
      image_url: '',
      stripe_payment_link: '',
      in_stock: true,
    },
  ];

  // -- State --
  const cartKey = 'ow_cart_v1';
  let cart = loadCart();
  let productsById = {};

  // -- Helpers --
  function fmt(cents, currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format((cents || 0) / 100);
  }
  function priceHtml(p) {
    const now = fmt(p.price_cents, p.currency);
    const cmp = p.compare_at_price_cents;
    if (cmp && cmp > p.price_cents) {
      const pct = Math.round((1 - p.price_cents / cmp) * 100);
      return `<span class="price-compare">${fmt(cmp, p.currency)}</span><span class="price-now">${now}</span><span class="price-badge">${pct}% OFF</span>`;
    }
    return now;
  }
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(cartKey)) || []; } catch { return []; }
  }
  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCart();
    updateCartCount();
  }

  // -- Load products --
  async function loadProducts() {
    if (supa) {
      const { data, error } = await supa
        .from('products')
        .select('*')
        .eq('in_stock', true)
        .order('sort_order', { ascending: true });
      if (!error && data && data.length) return data;
      if (error) console.warn('[OFF.WRIST] Supabase error, falling back to samples:', error.message);
    }
    if (cfg.USE_SAMPLE_PRODUCTS_IF_UNCONFIGURED) return SAMPLE;
    return [];
  }

  function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (!products.length) {
      grid.innerHTML = '<div class="grid-empty">No products yet. Add rows to the <code>products</code> table.</div>';
      return;
    }
    productsById = Object.fromEntries(products.map((p) => [p.id, p]));
    grid.innerHTML = products
      .map((p) => {
        const gallery = Array.isArray(p.image_urls) && p.image_urls.length
          ? p.image_urls
          : (p.image_url ? [p.image_url] : []);
        const primary = gallery[0];
        const secondary = gallery[1];
        const img = primary
          ? `<img class="img-primary" src="${escapeAttr(primary)}" alt="${escapeAttr(p.name)}" loading="lazy" />` +
            (secondary ? `<img class="img-secondary" src="${escapeAttr(secondary)}" alt="" loading="lazy" />` : '')
          : `<div class="product-img-placeholder">PHOTO COMING SOON</div>`;
        const href = `product.html?slug=${encodeURIComponent(p.slug)}`;
        return `
          <article class="product-card">
            <a class="product-link" href="${href}">
              <div class="product-img">${img}</div>
              <h3 class="product-title">${escapeHtml(p.name)}</h3>
              <p class="product-meta">${escapeHtml(p.color || '')}</p>
              <p class="product-price">${priceHtml(p)}</p>
            </a>
            <button class="product-add" data-id="${escapeAttr(p.id)}" ${p.in_stock === false ? 'disabled' : ''}>
              ${p.in_stock === false ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </article>
        `;
      })
      .join('');
    grid.querySelectorAll('.product-add').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // -- Cart --
  function addToCart(productId) {
    const p = productsById[productId];
    if (!p) return;
    const existing = cart.find((line) => line.id === productId);
    if (existing) existing.qty += 1;
    else cart.push({ id: productId, qty: 1 });
    saveCart();
    openCart();
  }
  function setQty(productId, qty) {
    const line = cart.find((l) => l.id === productId);
    if (!line) return;
    line.qty = Math.max(0, qty);
    if (line.qty === 0) cart = cart.filter((l) => l.id !== productId);
    saveCart();
  }
  function removeLine(productId) {
    cart = cart.filter((l) => l.id !== productId);
    saveCart();
  }
  function cartTotalCents() {
    return cart.reduce((sum, l) => sum + (productsById[l.id]?.price_cents || 0) * l.qty, 0);
  }
  function updateCartCount() {
    document.getElementById('cartCount').textContent = cart.reduce((n, l) => n + l.qty, 0);
  }
  function renderCart() {
    const items = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (!cart.length) {
      items.innerHTML = '<p class="cart-empty">Your bag is empty.</p>';
      document.getElementById('cartTotal').textContent = fmt(0, 'usd');
      checkoutBtn.disabled = true;
      return;
    }
    items.innerHTML = cart
      .map((line) => {
        const p = productsById[line.id];
        if (!p) return '';
        const img = p.image_url
          ? `<img src="${escapeAttr(p.image_url)}" alt="" />`
          : '';
        return `
          <div class="cart-line">
            <div class="cart-line-img">${img}</div>
            <div class="cart-line-info">
              <p class="cart-line-name">${escapeHtml(p.name)}</p>
              <p class="cart-line-meta">${escapeHtml(p.color || '')} · ${fmt(p.price_cents, p.currency)}</p>
              <div class="cart-line-controls">
                <div class="cart-qty">
                  <button data-act="dec" data-id="${escapeAttr(p.id)}">−</button>
                  <span>${line.qty}</span>
                  <button data-act="inc" data-id="${escapeAttr(p.id)}">+</button>
                </div>
                <button class="cart-line-remove" data-act="rm" data-id="${escapeAttr(p.id)}">REMOVE</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
    items.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        const line = cart.find((l) => l.id === id);
        if (!line) return;
        if (b.dataset.act === 'inc') setQty(id, line.qty + 1);
        if (b.dataset.act === 'dec') setQty(id, line.qty - 1);
        if (b.dataset.act === 'rm') removeLine(id);
      });
    });
    document.getElementById('cartTotal').textContent = fmt(cartTotalCents(), 'usd');
    checkoutBtn.disabled = false;
  }
  function openCart() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartBackdrop').classList.add('open');
  }
  function closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartBackdrop').classList.remove('open');
  }

  // -- Search --
  let allProducts = [];
  function openSearch() {
    document.getElementById('searchOverlay').classList.add('open');
    const input = document.getElementById('searchInput');
    input.value = '';
    runSearch('');
    setTimeout(() => input.focus(), 50);
  }
  function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('open');
  }
  function runSearch(rawQuery) {
    const q = (rawQuery || '').trim().toLowerCase();
    const results = document.getElementById('searchResults');
    if (!allProducts.length) {
      results.innerHTML = '<p class="search-empty">Loading…</p>';
      return;
    }
    let list;
    if (!q) {
      list = allProducts.slice();
    } else {
      // Score: exact color match (3) > color contains (2) > name contains (1)
      list = allProducts
        .map((p) => {
          const color = (p.color || '').toLowerCase();
          const name  = (p.name  || '').toLowerCase();
          let score = 0;
          if (color === q) score = 3;
          else if (color.includes(q)) score = 2;
          else if (name.includes(q)) score = 1;
          return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || (a.p.sort_order || 0) - (b.p.sort_order || 0))
        .map((x) => x.p);
    }
    if (!list.length) {
      results.innerHTML = `<p class="search-empty">No matches for "${escapeHtml(rawQuery)}". Try a color like blue, green, red, or pink.</p>`;
      return;
    }
    results.innerHTML = `
      <div class="search-grid">
        ${list.map((p) => {
          const gallery = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
          const img = gallery[0]
            ? `<img src="${escapeAttr(gallery[0])}" alt="${escapeAttr(p.name)}" />`
            : `<div class="product-img-placeholder">PHOTO</div>`;
          return `
            <a class="search-card" href="product.html?slug=${encodeURIComponent(p.slug)}">
              <div class="search-card-img">${img}</div>
              <div class="search-card-info">
                <p class="search-card-name">${escapeHtml(p.name)}</p>
                <p class="search-card-meta">${escapeHtml(p.color || '')} · ${fmt(p.price_cents, p.currency)}</p>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  // -- Checkout (Stripe Checkout Session via /api/checkout) --
  async function checkout() {
    if (!cart.length) return;
    const items = [];
    const missing = [];
    cart.forEach((line) => {
      const p = productsById[line.id];
      if (!p) return;
      if (!p.stripe_price_id) missing.push(p.name);
      else items.push({ price_id: p.stripe_price_id, qty: line.qty });
    });
    if (missing.length) {
      alert('These items have no Stripe price yet:\n\n' + missing.join('\n'));
      return;
    }
    const btn = document.getElementById('checkoutBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'OPENING CHECKOUT…'; }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        // Likely running on plain static server (no serverless functions).
        const isLocal = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
        alert(
          isLocal
            ? 'Checkout requires the /api/checkout serverless function, which only runs on Vercel.\n\nTo test locally, install Vercel CLI:\n  npm i -g vercel\n  cd ~/off-wrist && vercel dev\n\nOr just deploy to Vercel — checkout works there.'
            : 'Checkout endpoint not available. Make sure the project is deployed on Vercel.'
        );
        if (btn) { btn.disabled = false; btn.textContent = 'CHECKOUT'; }
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert('Checkout error: ' + (data.error || res.statusText));
        if (btn) { btn.disabled = false; btn.textContent = 'CHECKOUT'; }
        return;
      }
      window.location = data.url;
    } catch (e) {
      alert('Network error: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'CHECKOUT'; }
    }
  }

  // -- PDP (product detail page) --
  const FEATURES = [
    'Matte premium finish',
    'Lightweight, hollow-center build',
    'Houses your collectible pocket-style watch head',
    'Crown positioned above the bezel',
    'Integrated strap — seamless sport-watch silhouette',
    'Tool-free fit; designed for everyday wear',
  ];
  const PDP_LONG = (p) => p.description || '';

  async function loadOneBySlug(slug) {
    if (!supa) {
      const sample = SAMPLE.find((p) => p.slug === slug);
      return sample || null;
    }
    const { data, error } = await supa.from('products').select('*').eq('slug', slug).single();
    if (error) {
      console.warn('[OFF.WRIST] PDP load error:', error.message);
      return null;
    }
    return data;
  }

  async function loadOthers(currentSlug) {
    if (!supa) return SAMPLE.filter((p) => p.slug !== currentSlug).slice(0, 4);
    const { data } = await supa
      .from('products')
      .select('*')
      .neq('slug', currentSlug)
      .eq('in_stock', true)
      .order('sort_order', { ascending: true })
      .limit(4);
    return data || [];
  }

  function renderPdp(p, others) {
    const root = document.getElementById('pdp');
    if (!root) return;
    if (!p) {
      root.innerHTML = '<p class="pdp-loading">Product not found. <a href="./index.html">Back to shop</a>.</p>';
      return;
    }
    document.title = `${p.name} — OFF.WRIST`;
    productsById[p.id] = p;
    const gallery = Array.isArray(p.image_urls) && p.image_urls.length
      ? p.image_urls
      : (p.image_url ? [p.image_url] : []);
    const mainImg = gallery[0] || '';
    const thumbs = gallery
      .map((url, i) => `<button class="pdp-thumb${i === 0 ? ' active' : ''}" data-src="${escapeAttr(url)}" aria-label="View image ${i + 1}"><img src="${escapeAttr(url)}" alt="" /></button>`)
      .join('');
    const longDesc = PDP_LONG(p);
    const features = FEATURES.map((f) => `<li>${escapeHtml(f)}</li>`).join('');

    root.innerHTML = `
      <nav class="pdp-crumbs">
        <a href="./index.html">SHOP</a> <span>/</span> <span>${escapeHtml(p.name)}</span>
      </nav>
      <section class="pdp-grid">
        <div class="pdp-gallery">
          <div class="pdp-main">
            ${mainImg
              ? `<img id="pdpMainImg" src="${escapeAttr(mainImg)}" alt="${escapeAttr(p.name)}" />`
              : `<div class="product-img-placeholder">PHOTO COMING SOON</div>`}
          </div>
          ${thumbs ? `<div class="pdp-thumbs">${thumbs}</div>` : ''}
        </div>
        <div class="pdp-info">
          <p class="eyebrow">CONVERSION CASE · ${escapeHtml((p.color || '').toUpperCase())}</p>
          <h1 class="pdp-title">${escapeHtml(p.name)}</h1>
          <p class="pdp-price">${priceHtml(p)}</p>
          <div class="pdp-desc">${escapeHtml(longDesc).split('\n').filter(Boolean).map((para) => `<p>${para}</p>`).join('')}</div>
          <div class="pdp-actions">
            <button class="btn btn-primary btn-full" id="pdpAdd" ${p.in_stock === false ? 'disabled' : ''}>
              ${p.in_stock === false ? 'SOLD OUT' : 'ADD TO BAG · ' + fmt(p.price_cents, p.currency)}
            </button>
          </div>
          <div class="pdp-features">
            <h4>SPECS &amp; FEATURES</h4>
            <ul>${features}</ul>
          </div>
        </div>
      </section>
      ${others.length
        ? `<section class="pdp-others">
            <h3>MORE COLORS</h3>
            <div class="grid">
              ${others.map((o) => {
                const og = Array.isArray(o.image_urls) && o.image_urls.length ? o.image_urls : (o.image_url ? [o.image_url] : []);
                const primary = og[0]; const secondary = og[1];
                const img = primary
                  ? `<img class="img-primary" src="${escapeAttr(primary)}" alt="${escapeAttr(o.name)}" />` +
                    (secondary ? `<img class="img-secondary" src="${escapeAttr(secondary)}" alt="" />` : '')
                  : `<div class="product-img-placeholder">PHOTO</div>`;
                return `
                  <article class="product-card">
                    <a class="product-link" href="product.html?slug=${encodeURIComponent(o.slug)}">
                      <div class="product-img">${img}</div>
                      <h3 class="product-title">${escapeHtml(o.name)}</h3>
                      <p class="product-meta">${escapeHtml(o.color || '')}</p>
                      <p class="product-price">${priceHtml(o)}</p>
                    </a>
                  </article>`;
              }).join('')}
            </div>
          </section>`
        : ''}
    `;

    // Thumb click → swap main image
    root.querySelectorAll('.pdp-thumb').forEach((b) => {
      b.addEventListener('click', () => {
        const src = b.dataset.src;
        document.getElementById('pdpMainImg').src = src;
        root.querySelectorAll('.pdp-thumb').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    const addBtn = document.getElementById('pdpAdd');
    if (addBtn) addBtn.addEventListener('click', () => addToCart(p.id));
  }

  // -- Wire up --
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartBackdrop').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', checkout);

  const searchBtn = document.getElementById('searchBtn');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');
  const searchOverlay = document.getElementById('searchOverlay');
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchInput) searchInput.addEventListener('input', (e) => runSearch(e.target.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('open')) closeSearch();
  });

  const pdpRoot = document.getElementById('pdp');
  if (pdpRoot) {
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) {
      pdpRoot.innerHTML = '<p class="pdp-loading">No product slug. <a href="./index.html">Back to shop</a>.</p>';
      renderCart();
      updateCartCount();
      loadProducts().then((products) => { allProducts = products; });
    } else {
      loadProducts().then((products) => {
        allProducts = products;
        const p = products.find((x) => x.slug === slug) || null;
        const others = products.filter((x) => x.slug !== slug).slice(0, 4);
        renderPdp(p, others);
        renderCart();
        updateCartCount();
      });
    }
  } else {
    loadProducts().then((products) => {
      allProducts = products;
      renderProducts(products);
      renderCart();
      updateCartCount();
    });
  }
})();
