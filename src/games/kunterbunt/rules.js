/**
 * Shared, side-effect-free Kunterbunt rules (used by server.js and the client UI).
 *
 * @typedef {'kirsche' | 'sonne' | 'wiese' | 'meer'} BuntColor
 * @typedef {'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'plus2' | 'skip' | 'reverse' | 'wild' | 'wild4'} BuntValue
 * @typedef {{ id: string, color: BuntColor | null, value: BuntValue, wishColor?: BuntColor | null }} BuntCard
 */

/** @type {BuntColor[]} */
export const BUNT_COLORS = ['kirsche', 'sonne', 'wiese', 'meer'];

/** @type {BuntValue[]} */
export const BUNT_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Sort order inside one colour. */
/** @type {BuntValue[]} */
export const BUNT_VALUES = [...BUNT_NUMBERS, 'plus2', 'skip', 'reverse', 'wild', 'wild4'];

/** @type {Record<BuntColor, string>} */
export const BUNT_COLOR_NAMES = { kirsche: 'Kirsche', sonne: 'Sonne', wiese: 'Wiese', meer: 'Meer' };

/** Shape mark per colour, so colour is never the only cue. */
/** @type {Record<BuntColor, 'circle' | 'triangle' | 'square' | 'diamond'>} */
export const BUNT_COLOR_SHAPES = { kirsche: 'circle', sonne: 'triangle', wiese: 'square', meer: 'diamond' };

/** @type {Record<string, string>} */
const VALUE_NAMES = {
  plus2: '+2',
  skip: 'Aussetzen',
  reverse: 'Richtungswechsel',
  wild: 'Farbwunsch',
  wild4: 'Farbwunsch +4'
};

/** @param {BuntValue} value */
export function isBuntNumber(value) {
  return BUNT_NUMBERS.includes(value);
}

/** @param {BuntValue} value */
export function isBuntWild(value) {
  return value === 'wild' || value === 'wild4';
}

/** @param {BuntValue} value */
export function buntValueName(value) {
  return VALUE_NAMES[value] ?? value;
}

/**
 * Accessible / log name, e.g. „Meer 7“, „Kirsche +2“, „Farbwunsch +4“.
 * @param {BuntCard} card
 */
export function buntCardName(card) {
  if (isBuntWild(card.value) || !card.color) return buntValueName(card.value);
  return `${BUNT_COLOR_NAMES[card.color]} ${buntValueName(card.value)}`;
}

/**
 * Can `card` be played on the current discard pile?
 * @param {BuntCard} card
 * @param {{ discardPile: BuntCard[], pendingDraw: number, wishColor: BuntColor | null }} state
 */
export function isBuntCardPlayable(card, state) {
  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) return true;
  if (state.pendingDraw > 0) {
    // On a +2 stack: another +2 or a +4. On a +4 stack: only another +4.
    if (top.value === 'wild4') return card.value === 'wild4';
    return card.value === 'plus2' || card.value === 'wild4';
  }
  if (isBuntWild(card.value)) return true;
  if (state.wishColor) return card.color === state.wishColor;
  return card.color === top.color || card.value === top.value;
}
