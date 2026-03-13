// UPF Detection Engine — NOVA Group 4 marker ingredients (Norwegian + Swedish)
// A product is UPF if its ingredient list contains ANY of these markers.
// Moderate strictness: only clear UPF indicators, debatable items removed.

const MARKER_CATEGORIES = [
  {
    id: 'modified-sugars',
    name: 'Modifiserte sukkerarter/sirup',
    markers: [
      'glukose-fruktosesirup',
      'fruktose-glukosesirup',
      'fruktosesirup',
      'glukosesirup',
      'høyfruktose',
      'maissirup',
      'invertsukkert',
      'maltodekstrin',
      'dekstrose',
      'isoglukose',
      'druesukker',        // NO alt. for dextrose
      'glukossirap',       // SV glucose syrup
      'fruktossirap',      // SV fructose syrup
      'druvsocker',        // SV dextrose/grape sugar
    ],
  },
  {
    id: 'modified-fats',
    name: 'Modifiserte fettstoffer',
    markers: [
      'herdet fett',
      'hydrogenert',
      'interesterifisert',
      'härdat fett',       // SV hardened fat
    ],
  },
  {
    id: 'modified-starch',
    name: 'Modifisert stivelse',
    markers: [
      'modifisert stivelse',
      'modifierad stärkelse', // SV modified starch
    ],
  },
  {
    id: 'protein-isolates',
    name: 'Proteinisolater',
    markers: [
      'soyaproteinisolat',
      'soyaprotein',
      'myseprotein',
      'whey protein',
      'kasein',
      'hydrolysert protein',
      'hydrolysert vegetabilsk',
      'proteinkonsentrat',
      'proteinisolat',
      'mekanisk separert',
      'sojaprotein',          // SV soy protein
      'sojaproteinisolat',    // SV soy protein isolate
      'mjölkprotein',         // SV milk protein
      'vassleprotein',        // SV whey protein
      'hydrolyserat protein', // SV hydrolyzed protein
      'proteinkoncentrat',    // SV protein concentrate
      'mekaniskt separerat',  // SV mechanically separated
    ],
  },
  {
    id: 'emulsifiers',
    name: 'Emulgatorer',
    markers: [
      'emulgator',
      'emulgatorer',
      'karrageen',
      'karragenan',
      'stabilisator',
      'stabilisatorer',
      'fortykningsmiddel',
      'fortykningsmidler',
      'emulgeringsmedel',     // SV emulsifier
      'stabiliseringsmedel',  // SV stabilizer
      'förtjockningsmedel',   // SV thickener
    ],
  },
  {
    id: 'colorings',
    name: 'Fargestoffer',
    markers: [
      'fargestoff',
      'fargstoff',
      'färgämne',    // SV colorant
    ],
  },
  {
    id: 'flavor-enhancers',
    name: 'Smaksforsterkere',
    markers: [
      'smaksforsterker',
      'glutamat',
      'mononatriumglutamat',
      'smakförstärkare',   // SV flavor enhancer
    ],
  },
  {
    id: 'flavorings',
    name: 'Aromastoffer',
    markers: [
      'aroma',
      'arom',              // SV flavoring (word-boundary matched)
      'aromastoff',
      'naturidentisk aroma',
    ],
  },
  {
    id: 'sweeteners',
    name: 'Søtstoffer',
    markers: [
      'søtstoff',
      'aspartam',
      'sukralose',
      'acesulfam',
      'syklamat',
      'sakkarin',
      'steviolglykosid',
      'erytritol',
      'xylitol',
      'sorbitol',
      'maltitol',
      'isomalt',
      'sötningsmedel',    // SV sweetener
    ],
  },
  {
    id: 'preservatives',
    name: 'Konserveringsmidler',
    markers: [
      'konserveringsmiddel',
      'konserveringsmidler',
      'natriumbensoat',
      'kaliumsorbat',
      'natriumnitritt',
      'natriumnitrat',
      'konserveringsmedel',  // SV preservative
    ],
  },
  {
    id: 'other-additives',
    name: 'Andre tilsetningsstoffer',
    markers: [
      'antiklumpemiddel',
      'surhetsregulerende',
      'fuktighetsbevarende',
      'antiklumpmedel',      // SV anti-caking
      'surhetsreglerande',   // SV acidity regulator
    ],
  },
  {
    id: 'e-numbers',
    name: 'E-numre',
    markers: [], // E-numbers handled by regex, this category toggles detection on/off
  },
];

// E-number regex: matches E followed by 3-4 digits (E100–E1520)
const E_NUMBER_REGEX = /\bE[\s-]?\d{3,4}[a-z]?\b/gi;

// Natural E-numbers that should NOT trigger UPF classification
const E_NUMBER_WHITELIST = new Set([
  'e100',  // Curcumin (turmeric)
  'e101',  // Riboflavin (vitamin B2)
  'e160',  // Carotenoids
  'e160a', // Carotenoids (alpha/beta-carotene)
  'e160c', // Paprika extract
  'e162',  // Beetroot red
  'e163',  // Anthocyanins (from berries/grapes)
  'e170',  // Calcium carbonate (chalk)
  'e200',  // Sorbic acid (natural)
  'e270',  // Lactic acid
  'e290',  // Carbon dioxide
  'e300',  // Ascorbic acid (vitamin C)
  'e301',  // Sodium ascorbate
  'e306',  // Tocopherols (vitamin E)
  'e307',  // Alpha-tocopherol
  'e322',  // Lecithins (soya lecithin)
  'e325',  // Sodium lactate
  'e330',  // Citric acid
  'e331',  // Sodium citrate
  'e332',  // Potassium citrate
  'e333',  // Calcium citrate
  'e334',  // Tartaric acid
  'e335',  // Sodium tartrate
  'e336',  // Potassium tartrate (cream of tartar)
  'e375',  // Niacin (vitamin B3)
  'e392',  // Rosemary extract
  'e400',  // Alginic acid (from seaweed)
  'e401',  // Sodium alginate
  'e406',  // Agar (from seaweed)
  'e410',  // Locust bean gum
  'e412',  // Guar gum
  'e440',  // Pectin
  'e500',  // Sodium bicarbonate (baking soda)
  'e501',  // Potassium carbonate
  'e503',  // Ammonium carbonate (baker's ammonia)
  'e516',  // Calcium sulfate
  'e524',  // Sodium hydroxide
  'e938',  // Argon
  'e941',  // Nitrogen
  'e948',  // Oxygen
]);

// ─── Settings (synced from chrome.storage.sync) ───────────────────────
let _settings = {
  disabledCategories: [],
  customMarkers: [],
  removedMarkers: [],
};

/**
 * Load settings from chrome.storage.sync (synchronous cache update).
 * Called once at startup and on storage change events.
 */
function loadSettingsSync() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.get(['disabledCategories', 'customMarkers', 'removedMarkers'], (data) => {
      _settings.disabledCategories = data.disabledCategories || [];
      _settings.customMarkers = data.customMarkers || [];
      _settings.removedMarkers = data.removedMarkers || [];
    });
  }
}

// Load on script init
loadSettingsSync();

/**
 * Get the effective list of active markers based on current settings.
 * Returns { markers: string[], eNumbersEnabled: boolean }
 */
function getActiveMarkers() {
  const removedSet = new Set(_settings.removedMarkers);
  const disabledSet = new Set(_settings.disabledCategories);

  const markers = [];
  let eNumbersEnabled = true;

  for (const cat of MARKER_CATEGORIES) {
    if (disabledSet.has(cat.id)) {
      if (cat.id === 'e-numbers') eNumbersEnabled = false;
      continue;
    }
    for (const m of cat.markers) {
      if (!removedSet.has(m)) markers.push(m);
    }
  }

  // Add custom markers
  for (const m of _settings.customMarkers) {
    markers.push(m);
  }

  return { markers, eNumbersEnabled };
}

/**
 * Check if an ingredient text indicates UPF.
 * @param {string} text - The ingredient list text
 * @param {{ markers: string[], eNumbersEnabled: boolean }|null} activeMarkers - optional pre-computed active markers
 * @returns {{ isUPF: boolean, matches: string[] }}
 */
function classifyIngredients(text, activeMarkers) {
  const lower = text.toLowerCase();
  const matches = [];

  const { markers, eNumbersEnabled } = activeMarkers || getActiveMarkers();

  // Check all active markers
  for (const marker of markers) {
    // Special handling for 'aroma'/'arom': word-boundary match to avoid
    // matching inside 'aromastoff' etc.
    if (marker === 'aroma' || marker === 'arom') {
      const re = new RegExp('\\b' + marker + '\\b', 'i');
      if (re.test(text) && !/\bnaturlig aroma\b/i.test(lower)) {
        matches.push(marker);
      }
      continue;
    }
    if (lower.includes(marker)) {
      matches.push(marker);
    }
  }

  // Check E-numbers (excluding whitelisted natural ones)
  if (eNumbersEnabled) {
    const eNumbers = text.match(E_NUMBER_REGEX);
    if (eNumbers) {
      for (const e of eNumbers) {
        const normalized = e.replace(/[\s-]/g, '').toLowerCase();
        if (!E_NUMBER_WHITELIST.has(normalized)) {
          matches.push(e);
        }
      }
    }
  }

  return {
    isUPF: matches.length > 0,
    matches: [...new Set(matches)], // deduplicate
  };
}
