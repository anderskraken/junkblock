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
   * Find the product detail object in the dehydratedState queries array.
   * Oda's query order varies, so we search for the productDetailApi query
   * or fall back to the first query with a product-like data shape.
   */
  function findProductInQueries(queries) {
    if (!Array.isArray(queries)) return null;
    // Look for the productDetailApi query first
    for (const q of queries) {
      const key = q.queryKey;
      if (Array.isArray(key) && key.some(k => k?._id === 'productDetailApi')) {
        return q.state?.data || null;
      }
    }
    // Fallback: find first query whose data has an id and detailedInfo
    for (const q of queries) {
      const d = q.state?.data;
      if (d && typeof d === 'object' && d.id && (d.detailedInfo || d.fullName)) {
        return d;
      }
    }
    return null;
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
      const product = findProductInQueries(data.pageProps?.dehydratedState?.queries);
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

    const activeMarkers = typeof getActiveMarkers === 'function' ? getActiveMarkers() : null;
    const { isUPF, matches } = classifyIngredients(ingredientText, activeMarkers);
    const result = { isUPF, matches, name, noIngredients: false };
    cache.set(String(productId), result);
    log(name, '→', isUPF ? `Ultra [${matches.join(', ')}]` : 'Ikke UPF');
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
  function insertBadge(target, isUPF, matches, isIconRow) {
    if (!target || target.hasAttribute(BADGE_ATTR)) return;

    const wrapper = document.createElement('span');
    wrapper.className = isIconRow
      ? 'upf-badge-wrapper upf-badge-wrapper--icon-row'
      : 'upf-badge-wrapper';

    const badge = document.createElement('span');
    badge.className = isUPF ? 'upf-badge upf-badge--upf' : 'upf-badge upf-badge--clean';

    const dot = document.createElement('span');
    dot.className = 'upf-badge__dot';
    badge.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = isUPF ? 'Ultra' : 'Ikke UPF';
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
      badge.setAttribute('title', 'Ingen ultra-markører funnet – ikke UPF');
    }

    target.setAttribute(BADGE_ATTR, isUPF ? 'upf' : 'clean');

    if (isIconRow) {
      // In icon row: append as flex item (margin-left: auto pushes it right)
      target.appendChild(wrapper);
    } else if (target.tagName.match(/^H[1-6]$/) || target.tagName === 'P') {
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
      const product = findProductInQueries(nextData?.props?.pageProps?.dehydratedState?.queries);
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

    // Try to find the detail-page classifier icon row (keyhole/globe icons).
    // Use the image-column module class to avoid matching listing-card classifiers.
    const detailClassifier = document.querySelector(
      '[class*="image-column"][class*="classifierWrapper"]'
    );
    if (detailClassifier && !detailClassifier.hasAttribute(BADGE_ATTR)) {
      insertBadge(detailClassifier, result.isUPF, result.matches, true);
      return;
    }

    // No classifier row — create one inside the detail image box
    // (same position as keyhole/globe icons on other products)
    const detailImageBox = document.querySelector(
      '[class*="image-column"][class*="imageBox"]'
    );
    if (detailImageBox && !detailImageBox.querySelector('[' + BADGE_ATTR + ']')) {
      let row = detailImageBox.querySelector('[' + ICON_ROW_ATTR + ']');
      if (!row) {
        row = document.createElement('div');
        row.setAttribute(ICON_ROW_ATTR, '');
        row.style.cssText = 'display:flex;gap:4px;align-items:center;align-self:flex-start;';
        detailImageBox.appendChild(row);
      }
      insertBadge(row, result.isUPF, result.matches, true);
      return;
    }

    // Not rendered yet — do nothing, next mutation scan will retry
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

  /**
   * Find the icon row (ProductClassifiersTile) for a product card.
   * Falls back to the product name <p> or the link itself.
   */
  const ICON_ROW_ATTR = 'data-upf-icon-row';

  function findBadgeTarget(productLink) {
    const article = productLink.closest('article');
    if (article) {
      // Check if we already badged this article
      if (article.querySelector('[' + BADGE_ATTR + ']')) return { element: null, isIconRow: true };

      // Look for the classifier icon row inside the image box
      const iconRow = article.querySelector('[class*="ProductClassifiersTile"]');
      if (iconRow) return { element: iconRow, isIconRow: true };

      // Check for a previously created icon row
      const existing = article.querySelector('[' + ICON_ROW_ATTR + ']');
      if (existing) return { element: existing, isIconRow: true };

      // If no icon row exists, try to create one inside ProductTileImageBox
      const imageBox = article.querySelector('[class*="ProductTileImageBox"]');
      if (imageBox) {
        const newRow = document.createElement('div');
        newRow.setAttribute(ICON_ROW_ATTR, '');
        newRow.style.cssText = 'display:flex;gap:4px;flex-direction:row;position:absolute;bottom:2px;left:2px;';
        imageBox.appendChild(newRow);
        return { element: newRow, isIconRow: true };
      }
    }
    // Fallback for non-card contexts (detail page h1, etc.)
    const nameEl = productLink.querySelector('p');
    return { element: nameEl || productLink, isIconRow: false };
  }

  async function fetchAndBadgeProducts(slugs) {
    const CONCURRENCY = 8;
    let index = 0;

    async function worker() {
      while (index < slugs.length) {
        const current = slugs[index++];
        const { id, slug, link } = current;

        const article = link.closest('article');
        if (article?.querySelector('[' + BADGE_ATTR + ']')) continue;
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
            const { element, isIconRow } = findBadgeTarget(freshLink);
            insertBadge(element, result.isUPF, result.matches, isIconRow);
          }
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  async function scanListingProducts() {
    // If we're on a detail page, get its product id so we skip it in listing scan
    const detailMatch = location.pathname.match(/\/products\/(\d+)-/);
    const detailId = detailMatch ? detailMatch[1] : null;

    const slugs = getProductSlugsFromPage();
    const unbadged = slugs.filter(({ id, link }) => {
      // Skip the product that's shown in the detail/modal view (handled by scanDetailView)
      if (id === detailId) return false;
      // Quick check: if the article already has a badge, skip
      const article = link.closest('article');
      if (article?.querySelector('[' + BADGE_ATTR + ']')) return false;
      if (link.querySelector('[' + BADGE_ATTR + ']')) return false;
      return true;
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
    if (hasProductInUrl()) {
      // Fire detail scan immediately so the badge appears without waiting for listings
      await scanDetailView();
    }
    // Scan listing cards in background (don't block on it)
    scanListingProducts();
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

  // Listen for settings changes from popup — clear cache and re-scan
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.disabledCategories || changes.customMarkers || changes.removedMarkers)) {
        log('Settings changed, re-scanning...');
        // Update the active markers in upf-rules
        if (typeof loadSettingsSync === 'function') loadSettingsSync();
        cache.clear();
        // Remove existing badges so they get re-created
        document.querySelectorAll('[' + BADGE_ATTR + ']').forEach(el => {
          el.removeAttribute(BADGE_ATTR);
          el.querySelectorAll('.upf-badge-wrapper').forEach(w => {
            if (w._upfTooltip) w._upfTooltip.remove();
            w.remove();
          });
        });
        debouncedScan();
      }
    });
  }

  log('JunkBlock initialized');
})();
