// UPF Detection Engine — NOVA Group 4 marker ingredients (Norwegian)
// A product is UPF if its ingredient list contains ANY of these markers.
// Moderate strictness: only clear UPF indicators, debatable items removed.

const UPF_MARKER_SUBSTANCES = [
  // Modified sugars / syrups
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

  // Modified fats/oils
  'herdet fett',
  'hydrogenert',
  'interesterifisert',
  // NOTE: palmefett removed — palm oil is NOVA Group 2 (culinary ingredient)

  // Modified starches
  'modifisert stivelse',

  // Protein isolates / hydrolysates
  'soyaproteinisolat',
  'soyaprotein',
  'myseprotein',
  'whey protein',
  'kasein',
  'hydrolysert protein',
  'hydrolysert vegetabilsk',
  'proteinkonsentrat',
  'proteinisolat',

  // Mechanically separated meat
  'mekanisk separert',
];

const UPF_COSMETIC_ADDITIVES = [
  // Emulsifiers
  'emulgator',
  'emulgatorer',
  // NOTE: lecitin removed — soya lecithin is common in non-UPF foods

  // Stabilizers / thickeners (cosmetic use)
  'stabilisator',
  'stabilisatorer',
  'fortykningsmiddel',
  'fortykningsmidler',
  // NOTE: gelatin removed — traditional ingredient, not inherently UPF
  'karrageen',
  'karragenan',

  // Colors
  'fargestoff',
  'fargstoff',

  // Flavor enhancers
  'smaksforsterker',
  'glutamat',
  'mononatriumglutamat',

  // Artificial/processed flavoring — one of the most common UPF indicators
  'aroma',
  'aromastoff',
  'naturidentisk aroma',

  // Sweeteners (non-sugar)
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

  // Preservatives (as additives)
  'konserveringsmiddel',
  'konserveringsmidler',
  'natriumbensoat',
  'kaliumsorbat',
  'natriumnitritt',
  'natriumnitrat',

  // Anti-caking, bulking, etc.
  'antiklumpemiddel',
  'surhetsregulerende',
  'fuktighetsbevarende',
  // NOTE: hevemiddel removed — baking powder is NOVA Group 2
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

/**
 * Check if an ingredient text indicates UPF.
 * @param {string} text - The ingredient list text
 * @returns {{ isUPF: boolean, matches: string[] }}
 */
function classifyIngredients(text) {
  const lower = text.toLowerCase();
  const matches = [];

  // Check marker substances
  for (const marker of UPF_MARKER_SUBSTANCES) {
    if (lower.includes(marker)) {
      matches.push(marker);
    }
  }

  // Check cosmetic additives
  for (const additive of UPF_COSMETIC_ADDITIVES) {
    // Special handling for 'aroma': avoid matching 'aromastoff' twice
    // and avoid matching within longer words like 'aromarik'
    if (additive === 'aroma') {
      // Match 'aroma' as a standalone word (not part of 'aromastoff', 'naturlig aroma' etc.)
      if (/\baroma\b/i.test(text) && !/\bnaturlig aroma\b/i.test(lower)) {
        matches.push(additive);
      }
      continue;
    }
    if (lower.includes(additive)) {
      matches.push(additive);
    }
  }

  // Check E-numbers (excluding whitelisted natural ones)
  const eNumbers = text.match(E_NUMBER_REGEX);
  if (eNumbers) {
    for (const e of eNumbers) {
      const normalized = e.replace(/[\s-]/g, '').toLowerCase();
      if (!E_NUMBER_WHITELIST.has(normalized)) {
        matches.push(e);
      }
    }
  }

  return {
    isUPF: matches.length > 0,
    matches: [...new Set(matches)], // deduplicate
  };
}
