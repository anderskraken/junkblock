// JunkBlock — Content Script
// Scans oda.com/no product pages for ingredient lists and adds Ultra/Ren badges.
// Uses Next.js __NEXT_DATA__ and data routes for reliable ingredient extraction.

(function () {
  'use strict';

  const BADGE_ATTR = 'data-upf-badge';
  const DEBUG = false;

  // Prevent multiple initializations (SPA re-injection)
  if (window.__upfMarkerInitialized) return;
  window.__upfMarkerInitialized = true;

  function log(...args) {
    if (DEBUG) console.log('[JunkBlock]', ...args);
  }

  // ─── Cache ────────────────────────────────────────────────────────
  // productId → { isUPF, matches, name, noIngredients }
  const cache = new Map();

  // ─── Next.js helpers ──────────────────────────────────────────────

  function getNextData() {
    try {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? JSON.parse(el.textContent) : null;
    } catch {
      return null;
    }
  }

  function getBuildId() {
    return getNextData()?.buildId || null;
  }

  /**
   * Extract ingredient text from a product data object.
   */
  function extractIngredientsFromProduct(product) {
    const local = product?.detailedInfo?.local?.[0];
    if (!local?.contentsTable?.rows) return null;
    const row = local.contentsTable.rows.find(r => r.key === 'Ingredienser');
    return row?.value || null;
  }

  /**
   * Fetch product detail data via Next.js data route.
   */
  async function fetchProductData(slug) {
    const buildId = getBuildId();
    if (!buildId || !slug) return null;

    const cleanSlug = slug.replace(/^\/no\/products\//, '').replace(/\/$/, '');
    const url = `/_next/data/${buildId}/no/products/${cleanSlug}.json`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      const product = data.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
      if (!product) return null;
      return {
        id: product.id,
        name: product.fullName || product.name,
        ingredientText: extractIngredientsFromProduct(product),
      };
    } catch {
      return null;
    }
  }

  /**
   * Classify a product and cache the result.
   */
  function classifyAndCache(productId, name, ingredientText) {
    if (cache.has(String(productId))) return cache.get(String(productId));

    if (!ingredientText) {
      const result = { isUPF: false, matches: [], name, noIngredients: true };
      cache.set(String(productId), result);
      return result;
    }

    const { isUPF, matches } = classifyIngredients(ingredientText);
    const result = { isUPF, matches, name, noIngredients: false };
    cache.set(String(productId), result);
    log(name, '→', isUPF ? `Ultra [${matches.join(', ')}]` : 'Ren');
    return result;
  }

  // ─── Badge Creation ───────────────────────────────────────────────

  function createChevronSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('upf-badge__chevron');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 4.5 L6 7.5 L9 4.5');
    svg.appendChild(path);
    return svg;
  }

  function createTooltip(matches) {
    const tooltip = document.createElement('div');
    tooltip.className = 'upf-tooltip';

    const heading = document.createElement('div');
    heading.className = 'upf-tooltip__heading';
    heading.textContent = `${matches.length} ultra-markør${matches.length > 1 ? 'er' : ''} funnet`;
    tooltip.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'upf-tooltip__list';
    const MAX_VISIBLE = 8;
    for (const marker of matches.slice(0, MAX_VISIBLE)) {
      const item = document.createElement('li');
      item.className = 'upf-tooltip__item';
      item.textContent = marker;
      list.appendChild(item);
    }
    tooltip.appendChild(list);

    if (matches.length > MAX_VISIBLE) {
      const more = document.createElement('span');
      more.className = 'upf-tooltip__more';
      more.textContent = `+ ${matches.length - MAX_VISIBLE} til`;
      tooltip.appendChild(more);
    }
    return tooltip;
  }

  /**
   * Show tooltip with inline styles (inline beats any stylesheet specificity).
   * Uses position:fixed and clamps to viewport edges.
   */
  function showTooltip(badge, tooltip) {
    const rect = badge.getBoundingClientRect();
    const tooltipWidth = 280;
    const margin = 12;

    let left = rect.left;
    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin;
    }
    left = Math.max(margin, left);

    tooltip.style.position = 'fixed';
    tooltip.style.top = (rect.bottom + 6) + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
    tooltip.style.pointerEvents = 'auto';
    tooltip.style.transform = 'none';
    tooltip.classList.add('upf-tooltip--visible');
  }

  function hideAllTooltips() {
    document.querySelectorAll('.upf-tooltip--visible').forEach(el => {
      el.classList.remove('upf-tooltip--visible');
      el.style.opacity = '';
      el.style.visibility = '';
      el.style.pointerEvents = '';
    });
    document.querySelectorAll('.upf-badge-wrapper--open').forEach(el =>
      el.classList.remove('upf-badge-wrapper--open')
    );
  }

  /**
   * Insert a badge. For UPF products, creates a tooltip (appended to body)
   * and stores references on the wrapper for the global click handler.
   */
  function insertBadge(target, isUPF, matches) {
    if (!target || target.hasAttribute(BADGE_ATTR)) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'upf-badge-wrapper';

    const badge = document.createElement('span');
    badge.className = isUPF ? 'upf-badge upf-badge--upf' : 'upf-badge upf-badge--clean';

    const dot = document.createElement('span');
    dot.className = 'upf-badge__dot';
    badge.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = isUPF ? 'Ultra' : 'Ren';
    badge.appendChild(label);

    if (isUPF && matches.length > 0) {
      badge.appendChild(createChevronSVG());
      wrapper.appendChild(badge);

      // Tooltip appended to body so it escapes card overflow/transform
      const tooltip = createTooltip(matches);
      document.body.appendChild(tooltip);

      // Store tooltip reference on the wrapper so the global handler can find it
      wrapper._upfTooltip = tooltip;
      wrapper._upfBadge = badge;
    } else {
      wrapper.appendChild(badge);
      badge.setAttribute('title', 'Ingen ultra-markører funnet i ingredienslisten');
    }

    target.setAttribute(BADGE_ATTR, isUPF ? 'upf' : 'clean');

    if (target.tagName.match(/^H[1-6]$/) || target.tagName === 'P') {
      target.appendChild(document.createTextNode(' '));
      target.appendChild(wrapper);
    } else {
      target.insertBefore(wrapper, target.firstChild);
    }
  }

  // ─── Global click handler (capture phase on window) ──────────────
  // Must be on window capture to fire BEFORE React/Next.js delegated handlers
  // on document, which would otherwise navigate via the <a>/<Link> parent.

  window.addEventListener('click', (e) => {
    const badge = e.target.closest('.upf-badge--upf');
    if (badge) {
      const wrapper = badge.closest('.upf-badge-wrapper');
      if (wrapper?._upfTooltip) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const isOpen = wrapper.classList.contains('upf-badge-wrapper--open');
        hideAllTooltips();
        if (!isOpen) {
          wrapper.classList.add('upf-badge-wrapper--open');
          showTooltip(wrapper._upfBadge, wrapper._upfTooltip);
        }
        return;
      }
    }
    // Click outside any badge or tooltip → close all tooltips
    if (!e.target.closest('.upf-badge-wrapper') && !e.target.closest('.upf-tooltip')) {
      hideAllTooltips();
    }
  }, true); // capture phase on window — fires before document handlers

  // ─── Detail / Modal Page Scanner ──────────────────────────────────

  /**
   * Scan for a product detail view — either a full page or a modal overlay.
   * Extracts product slug from the current URL and fetches ingredient data.
   */
  async function scanDetailView() {
    const match = location.pathname.match(/\/products\/((\d+)-[^/]+)/);
    if (!match) return;
    const [, slug, id] = match;

    // Check cache first
    let result = cache.get(id);
    if (!result) {
      // Try __NEXT_DATA__ first (works on full page loads)
      const nextData = getNextData();
      const product = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
      if (product?.id === Number(id) && product?.detailedInfo) {
        const ingredientText = extractIngredientsFromProduct(product);
        result = classifyAndCache(product.id, product.fullName || product.name, ingredientText);
      } else {
        // Fetch via data route (works for modal views / SPA navigations)
        const data = await fetchProductData(slug);
        if (data) {
          result = classifyAndCache(data.id, data.name, data.ingredientText);
        }
      }
    }

    if (!result || result.noIngredients) {
      log(`Product ${id}: no ingredients, skipping`);
      return;
    }

    // Find the product title — could be in a modal or a full page
    // Look for an h1 that doesn't already have a badge
    const h1s = document.querySelectorAll('h1');
    for (const h1 of h1s) {
      if (h1.hasAttribute(BADGE_ATTR)) continue;
      // Check if this h1 contains the product name (or is reasonably close)
      const h1Text = h1.textContent?.trim();
      if (h1Text && result.name?.includes(h1Text)) {
        insertBadge(h1, result.isUPF, result.matches);
        return;
      }
    }
    // Fallback: badge the first unbadged h1
    for (const h1 of h1s) {
      if (!h1.hasAttribute(BADGE_ATTR)) {
        insertBadge(h1, result.isUPF, result.matches);
        return;
      }
    }
  }

  // ─── Listing Page Scanner ─────────────────────────────────────────

  function getProductSlugsFromPage() {
    const slugs = [];
    const links = document.querySelectorAll('a[href*="/products/"]');
    const seen = new Set();

    for (const link of links) {
      const match = link.getAttribute('href')?.match(/\/products\/((\d+)-[^/]+)/);
      if (!match) continue;
      const [, slug, id] = match;
      if (seen.has(id)) continue;
      seen.add(id);
      slugs.push({ id, slug, link });
    }
    return slugs;
  }

  function findCardNameElement(productLink) {
    const nameEl = productLink.querySelector('p');
    if (nameEl) return nameEl;
    return productLink;
  }

  async function fetchAndBadgeProducts(slugs) {
    const CONCURRENCY = 4;
    let index = 0;

    async function worker() {
      while (index < slugs.length) {
        const current = slugs[index++];
        const { id, slug, link } = current;

        if (link.querySelector('[' + BADGE_ATTR + ']')) continue;

        let result = cache.get(id);
        if (!result) {
          const data = await fetchProductData(slug);
          if (data) {
            result = classifyAndCache(data.id, data.name, data.ingredientText);
          }
        }

        if (result && !result.noIngredients) {
          const freshLink = document.querySelector(`a[href*="/products/${slug}"]`);
          if (freshLink) {
            const nameEl = findCardNameElement(freshLink);
            insertBadge(nameEl, result.isUPF, result.matches);
          }
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  async function scanListingProducts() {
    const slugs = getProductSlugsFromPage();
    const unbadged = slugs.filter(({ link }) => {
      const nameEl = findCardNameElement(link);
      return nameEl && !nameEl.hasAttribute(BADGE_ATTR);
    });

    if (unbadged.length === 0) return;
    log(`Fetching ingredient data for ${unbadged.length} product(s)...`);
    await fetchAndBadgeProducts(unbadged);
  }

  // ─── Main ─────────────────────────────────────────────────────────

  function hasProductInUrl() {
    return /\/products\/\d+-/.test(location.pathname);
  }

  async function scan() {
    // Always scan listing products (cards may be visible behind a modal)
    await scanListingProducts();

    // If we're on a product URL (full page or modal), also scan the detail view
    if (hasProductInUrl()) {
      await scanDetailView();
    }
  }

  // Initial scan
  scan();

  // Watch for DOM changes (SPA navigation, lazy loading, modal opens)
  let scanTimeout;
  let lastUrl = location.href;
  let scanning = false;

  function cleanupOrphanedTooltips() {
    document.querySelectorAll('.upf-tooltip').forEach(tooltip => {
      // Find if any wrapper in the DOM still references this tooltip
      const wrappers = document.querySelectorAll('.upf-badge-wrapper');
      let owned = false;
      for (const w of wrappers) {
        if (w._upfTooltip === tooltip) { owned = true; break; }
      }
      if (!owned) tooltip.remove();
    });
  }

  async function debouncedScan() {
    if (scanning) return;
    scanning = true;
    try {
      cleanupOrphanedTooltips();
      await scan();
    } finally { scanning = false; }
  }

  const observer = new MutationObserver(() => {
    const urlChanged = location.href !== lastUrl;
    if (urlChanged) {
      lastUrl = location.href;
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(debouncedScan, 300);
      return;
    }

    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(debouncedScan, 1000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  log('JunkBlock initialized');
})();
