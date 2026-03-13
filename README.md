# JunkBlock

Chrome extension that labels food products on [oda.com](https://oda.com/no/) as ultra-processed (UPF) or not, based on the NOVA classification system.

## What it does

JunkBlock scans product pages on Oda and adds badges to each product:

- **Ultra** (red) — contains ultra-processed ingredients (NOVA Group 4)
- **Ikke UPF** (grey) — no ultra-processed markers found

Click an Ultra badge to see which specific markers were detected (e.g., emulgator, maltodekstrin, E621).

## How it works

1. Extracts ingredient lists from Oda's Next.js data routes
2. Scans ingredients against a curated list of NOVA Group 4 markers (Norwegian + Swedish)
3. Checks for UPF indicator substances, cosmetic additives, and non-whitelisted E-numbers
4. Adds badges to product image icon rows on listing pages and detail pages

Works on listing/category pages, search results, and individual product pages including modal views.

## Install

Available on the [Chrome Web Store](https://chrome.google.com/webstore).

Or sideload for development:

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder
5. Browse [oda.com/no](https://oda.com/no/) — badges appear automatically

## Settings

Click the JunkBlock icon in your toolbar to open the settings popup:

- Toggle marker categories on/off (e.g., disable sweeteners or E-numbers)
- Add custom markers to flag additional ingredients
- Remove individual markers you disagree with

Settings sync across devices via Chrome storage.

## Classification rules

The detection engine uses categorized UPF markers:

- **Modified sugars/syrups** — glucose-fructose syrup, maltodextrin, dextrose, etc.
- **Modified fats** — hydrogenated, interesterified fats
- **Modified starch**
- **Protein isolates** — soy protein isolate, whey protein, casein, hydrolyzed protein, mechanically separated meat
- **Emulsifiers & stabilizers** — emulsifiers, stabilizers, thickeners, carrageenan
- **Colorings & flavor enhancers** — colorants, MSG, flavor enhancers
- **Flavorings** — aroma (excluding "naturlig aroma")
- **Sweeteners** — aspartame, sucralose, acesulfame, sugar alcohols, etc.
- **Preservatives** — sodium benzoate, potassium sorbate, sodium nitrite, etc.
- **E-numbers** — any E-number not on the ~40-item whitelist of natural/traditional additives (e.g., E330 citric acid, E322 lecithin, E500 baking soda are whitelisted)

Moderate strictness: traditional ingredients like lecithin, gelatin, and palm oil are NOT flagged.

## Privacy

All analysis happens locally in your browser. No data is collected or transmitted anywhere. See [privacy policy](privacy-policy.md).

## Tech

- Manifest V3, content script + settings popup
- Uses `storage` permission for user preferences only
- Fetches ingredient data via Oda's public Next.js data routes (no API keys)
- Concurrent fetching (8 parallel) with debounced scanning

## Files

```
manifest.json    — Extension manifest
upf-rules.js     — NOVA Group 4 classification engine + settings
content.js       — DOM scanning, badge insertion, tooltip logic
styles.css       — Badge and tooltip styles
popup.html/js/css — Settings popup UI
icons/           — Extension icons (16, 48, 128px)
privacy-policy.md — Privacy policy
```

## Contact

- Issues: https://github.com/anderskraken/junkblock/issues
- Email: numeric-softy-2t@icloud.com

## License

MIT
