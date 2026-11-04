/**
 * Shared, side-effect-free Würfelblock rules (used by server.js and the client UI).
 *
 * Rule decisions:
 * - Full House needs exactly three of one face and two of another face. Five equal dice
 *   are NOT a Full House (they score in Volltreffer, Dreierpasch, Viererpasch or Chance).
 * - Straights look at distinct faces only, so 1-2-3-4-4 is a Kleine Straße.
 *   A Große Straße (1-5 or 2-6) also counts as a Kleine Straße.
 * - There is no extra bonus for further Volltreffer.
 *
 * @typedef {'einser' | 'zweier' | 'dreier' | 'vierer' | 'fuenfer' | 'sechser' | 'dreierpasch' | 'viererpasch' | 'fullhouse' | 'kleinestrasse' | 'grossestrasse' | 'volltreffer' | 'chance'} BlockCategory
 * @typedef {Partial<Record<BlockCategory, number | null>>} BlockSheet
 */

/** @type {BlockCategory[]} */
export const UPPER_CATEGORIES = ['einser', 'zweier', 'dreier', 'vierer', 'fuenfer', 'sechser'];

/** @type {BlockCategory[]} */
export const LOWER_CATEGORIES = ['dreierpasch', 'viererpasch', 'fullhouse', 'kleinestrasse', 'grossestrasse', 'volltreffer', 'chance'];

/** @type {BlockCategory[]} */
export const CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

/** @type {Record<BlockCategory, string>} */
export const CATEGORY_NAMES = {
  einser: 'Einser',
  zweier: 'Zweier',
  dreier: 'Dreier',
  vierer: 'Vierer',
  fuenfer: 'Fünfer',
  sechser: 'Sechser',
  dreierpasch: 'Dreierpasch',
  viererpasch: 'Viererpasch',
  fullhouse: 'Full House',
  kleinestrasse: 'Kleine Straße',
  grossestrasse: 'Große Straße',
  volltreffer: 'Volltreffer',
  chance: 'Chance'
};

/** @type {Record<BlockCategory, string>} */
export const CATEGORY_HINTS = {
  einser: 'Summe der Einsen',
  zweier: 'Summe der Zweien',
  dreier: 'Summe der Dreien',
  vierer: 'Summe der Vieren',
  fuenfer: 'Summe der Fünfen',
  sechser: 'Summe der Sechsen',
  dreierpasch: '3 gleiche: Augensumme',
  viererpasch: '4 gleiche: Augensumme',
  fullhouse: '3 + 2 gleiche: 25',
  kleinestrasse: '4 in Folge: 30',
  grossestrasse: '5 in Folge: 40',
  volltreffer: '5 gleiche: 50',
  chance: 'Augensumme'
};

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;

/** @param {unknown} value */
export function isCategory(value) {
  return typeof value === 'string' && /** @type {string[]} */ (CATEGORIES).includes(value);
}

/** @param {unknown} dice */
export function isValidDice(dice) {
  return Array.isArray(dice) && dice.length === DICE_COUNT && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
}

/**
 * Points the dice would give in a category. Returns 0 for invalid dice.
 * @param {BlockCategory} category
 * @param {number[]} dice
 */
export function scoreCategory(category, dice) {
  if (!isValidDice(dice)) return 0;
  /** @type {number[]} */
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (const d of dice) {
    counts[d] += 1;
    sum += d;
  }
  const maxCount = Math.max(...counts);
  const upperIndex = UPPER_CATEGORIES.indexOf(category);
  if (upperIndex !== -1) return counts[upperIndex + 1] * (upperIndex + 1);

  switch (category) {
    case 'dreierpasch':
      return maxCount >= 3 ? sum : 0;
    case 'viererpasch':
      return maxCount >= 4 ? sum : 0;
    case 'fullhouse': {
      const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
      return nonZero.length === 2 && nonZero[0] === 2 && nonZero[1] === 3 ? 25 : 0;
    }
    case 'kleinestrasse':
      return longestRun(counts) >= 4 ? 30 : 0;
    case 'grossestrasse':
      return longestRun(counts) >= 5 ? 40 : 0;
    case 'volltreffer':
      return maxCount === 5 ? 50 : 0;
    case 'chance':
      return sum;
    default:
      return 0;
  }
}

/** @param {number[]} counts index 1..6 */
function longestRun(counts) {
  let best = 0;
  let run = 0;
  for (let face = 1; face <= 6; face += 1) {
    run = counts[face] > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * @param {BlockSheet | null | undefined} sheet
 */
export function sheetTotals(sheet) {
  let upper = 0;
  let lower = 0;
  let filled = 0;
  for (const category of UPPER_CATEGORIES) {
    const value = sheet?.[category];
    if (typeof value === 'number') {
      upper += value;
      filled += 1;
    }
  }
  for (const category of LOWER_CATEGORIES) {
    const value = sheet?.[category];
    if (typeof value === 'number') {
      lower += value;
      filled += 1;
    }
  }
  const bonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  return { upper, bonus, lower, total: upper + bonus + lower, filled };
}

/** @returns {BlockSheet} */
export function emptySheet() {
  /** @type {BlockSheet} */
  const sheet = {};
  for (const category of CATEGORIES) sheet[category] = null;
  return sheet;
}
