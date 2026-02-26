# JunkBlock

Chrome extension that labels food products on [oda.no](https://oda.com/no/) as ultra-processed (UPF) or clean, based on the NOVA classification system.

## What it does

JunkBlock scans product pages on Oda and adds badges to each product:

- **Ultra** (red) — contains ultra-processed ingredients (NOVA Group 4)
- **Ren** (green) — no ultra-processed markers found

Click an Ultra badge to see which specific markers were detected (e.g., emulgator, maltodekstrin, E621).

## How it works

1. Extracts ingredient lists from Oda's Next.js data routes
2. Scans ingredients against a curated list of NOVA Group 4 markers
3. Checks for UPF indicator substances, cosmetic additives, and non-whitelisted E-numbers
4. Adds inline badges to product cards and detail pages

Works on both listing/category pages and individual product pages, including modal views.

## Install (sideload)

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder
5. Browse [oda.com/no](https://oda.com/no/) — badges appear automatically

## Classification rules

The detection engine uses three categories of UPF markers:

- **Modified substances** — glucose-fructose syrup, hydrogenated fats, modified starch, protein isolates, etc.
- **Cosmetic additives** — emulsifiers, stabilizers, colorings, flavor enhancers, artificial sweeteners, preservatives
- **E-numbers** — any E-number not on the ~40-item whitelist of natural/traditional additives (e.g., E330 citric acid, E322 lecithin, E500 baking soda are whitelisted)

Moderate strictness: traditional ingredients like lecithin, gelatin, and palm oil are NOT flagged. Only clear NOVA Group 4 indicators trigger the Ultra label.

## Tech

- Manifest V3, content script only (no background page, no popup)
- Zero permissions required beyond the oda.no match pattern
- Fetches ingredient data via Oda's public Next.js data routes (no API keys)
- Concurrent fetching (4 parallel) with debounced scanning

## Files

```
manifest.json    — Extension manifest
upf-rules.js     — NOVA Group 4 classification engine
content.js       — DOM scanning, badge insertion, tooltip logic
styles.css       — Badge and tooltip styles (Nordic Garden palette)
icons/           — Extension icons (16, 48, 128px)
```

## License

MIT
