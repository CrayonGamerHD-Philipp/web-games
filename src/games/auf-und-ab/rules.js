/**
 * Auf & Ab – Regeln, die Server und Client gemeinsam nutzen.
 *
 * Vier Baustapel in der Mitte: zwei zählen von 1 bis 12 hoch, zwei von 12 bis 1 runter.
 * Joker passen überall und zählen als die gerade benötigte Zahl.
 *
 * @typedef {{ id: string, value: number | null }} AufCard  `value: null` = Joker
 * @typedef {{ card: AufCard, value: number }} AufPileEntry
 * @typedef {'up' | 'down'} AufDirection
 * @typedef {{ id: string, dir: AufDirection, cards: AufPileEntry[] }} AufBuildPile
 */

export const HAND_SIZE = 5;
export const DISCARD_PILES = 4;
export const MAX_VALUE = 12;
export const JOKER_COUNT = 18;

/** @type {{ id: string, dir: AufDirection, label: string }[]} */
export const BUILD_PILES = [
  { id: 'up1', dir: 'up', label: 'Auf' },
  { id: 'up2', dir: 'up', label: 'Auf' },
  { id: 'down1', dir: 'down', label: 'Ab' },
  { id: 'down2', dir: 'down', label: 'Ab' }
];

/** @returns {AufCard[]} 162 Karten: 1–12 je 12×, dazu 18 Joker. */
export function createDeck() {
  /** @type {AufCard[]} */
  const cards = [];
  for (let value = 1; value <= MAX_VALUE; value += 1) {
    for (let copy = 0; copy < 12; copy += 1) cards.push({ id: `a${value}-${copy}`, value });
  }
  for (let copy = 0; copy < JOKER_COUNT; copy += 1) cards.push({ id: `j-${copy}`, value: null });
  return cards;
}

/** @returns {AufBuildPile[]} */
export function emptyBuildPiles() {
  return BUILD_PILES.map((pile) => ({ id: pile.id, dir: pile.dir, cards: [] }));
}

/** @param {AufCard} card */
export function isJoker(card) {
  return card.value === null;
}

/**
 * Die Zahl, die als Nächstes auf den Stapel muss.
 * @param {AufBuildPile} pile
 */
export function nextValue(pile) {
  const top = pile.cards[pile.cards.length - 1];
  if (!top) return pile.dir === 'up' ? 1 : MAX_VALUE;
  return pile.dir === 'up' ? top.value + 1 : top.value - 1;
}

/**
 * @param {AufCard} card
 * @param {AufBuildPile} pile
 */
export function canPlay(card, pile) {
  return isJoker(card) || card.value === nextValue(pile);
}

/**
 * Ein Stapel ist fertig, wenn er bei 12 (aufwärts) bzw. 1 (abwärts) angekommen ist.
 * @param {AufBuildPile} pile
 */
export function isPileDone(pile) {
  const top = pile.cards[pile.cards.length - 1];
  if (!top) return false;
  return pile.dir === 'up' ? top.value >= MAX_VALUE : top.value <= 1;
}

/** @param {AufBuildPile} pile */
export function topValue(pile) {
  return pile.cards[pile.cards.length - 1]?.value ?? null;
}

/** @param {AufCard} card */
export function cardName(card) {
  return isJoker(card) ? 'Joker' : String(card.value);
}

/** @param {number | null} value */
export function valueTier(value) {
  if (value === null) return 'joker';
  if (value <= 4) return 'low';
  if (value <= 8) return 'mid';
  return 'high';
}
