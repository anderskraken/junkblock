# JunkBlock

Chrome extension that detects ultra-processed food (NOVA Group 4) on online grocery stores.

## Supported stores

- **Oda** (oda.com/no, oda.no) — Norwegian grocery, path prefix `/no/`
- **Mathem** (mathem.se) — Swedish grocery, path prefix `/se/`

Both are Next.js apps with identical data architecture: `__NEXT_DATA__` with React Query dehydrated state, `productDetailApi` query key, and `_next/data/{buildId}/` routes.

## Architecture

- `upf-rules.js` — NOVA Group 4 marker definitions (Norwegian + Swedish) and classification engine. Loaded first, exposes `classifyIngredients()`, `getActiveMarkers()`, `loadSettingsSync()`, and `MARKER_CATEGORIES` as globals.
- `content.js` — Content script injected on matched sites. Detects site via hostname, fetches ingredient data from Next.js data routes, inserts badges into product cards and detail pages. All logic is in a single IIFE.
- `styles.css` — Badge and tooltip styles with dark mode and reduced-motion support.
- `popup.html/js/css` — Settings popup for toggling marker categories, adding custom markers, removing individual markers.

## Key patterns

- Product data: `detailedInfo.local[0].contentsTable.rows` where `row.key === 'Ingredienser'`
- Badge placement: finds `[class*="ProductTileImageBox"]` in product cards, creates absolute-positioned overlay
- Detail page: uses `[class*="image-column"][class*="classifierWrapper"]` selectors
- Site prefix: `SITE_PATH_PREFIX` (`/no/` or `/se/`) used in data route URLs
- Settings stored in `chrome.storage.sync`

## Adding a new store

If the store uses Next.js with similar data structure:
1. Add match patterns to `manifest.json`
2. Add hostname detection and path prefix in `content.js`
3. Verify `ProductTileImageBox` / `classifierWrapper` selectors or add store-specific badge targets
4. Add any language-specific markers to `upf-rules.js`

## Markers

Norwegian and Swedish markers organized in 11 categories. Flavorings (`aroma`/`arom`/`aromer`) use word-boundary matching with exclusion for natural variants (`naturlig aroma`, `naturlig arom`, `naturliga aromer`). E-numbers matched by regex with a ~40-item whitelist of natural additives.
