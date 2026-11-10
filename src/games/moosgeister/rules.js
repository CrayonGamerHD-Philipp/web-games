/**
 * Moosgeister – Regeln, die Server und Client gemeinsam nutzen.
 *
 * Auslage: 9 Plätze (Index 0–8 = Zahl 1–9) in einem 3×3-Raster.
 * Jeder Platz hat höchstens eine offene Karte (`face`, ein Waldgeist) und
 * höchstens eine verdeckte Karte darunter (`moss`, Moos).
 *
 * @typedef {'blau' | 'gruen' | 'gelb' | 'rot'} MoosColor
 * @typedef {MoosColor | 'bunt'} MoosCardColor
 * @typedef {{ id: string, number: number, color: MoosCardColor, spirals: number, crosses: number, bonus: MoosColor | null }} MoosCard
 * @typedef {{ hidden: true }} HiddenCard
 * @typedef {{ face: MoosCard | null, moss: MoosCard | HiddenCard | null }} MoosSlot
 * @typedef {MoosSlot[]} MoosLayout
 * @typedef {{ kind: 'place', slot: number } | { kind: 'choose', slot: number } | { kind: 'cover', slot: number } | { kind: 'moss', slots: number[] } | { kind: 'discard' }} MoosPlacement
 * @typedef {{ numbers: number, spirals: number, crosses: number, bonus: number, groupSize: number, groupColor: MoosColor | null, group: number, total: number }} MoosScore
 */

/** @type {MoosColor[]} */
export const MOOS_COLORS = ['blau', 'gruen', 'gelb', 'rot'];

/** @type {Record<MoosCardColor, string>} */
export const MOOS_COLOR_NAMES = { blau: 'Blau', gruen: 'Grün', gelb: 'Gelb', rot: 'Rot', bunt: 'Bunt' };

/** @type {Record<string, MoosCardColor>} */
const COLOR_CODES = { b: 'blau', g: 'gruen', y: 'gelb', r: 'rot', m: 'bunt' };

/**
 * Das Kartenset: pro Zahl eine Liste kurzer Codes.
 * Buchstabe = Farbe (b blau, g grün, y gelb, r rot, m bunt), `s` = Spirale, `x` = Kreuz,
 * `+c` = 1 Punkt je Geist der Farbe c. Niedrige Zahlen bringen mehr Spiralen,
 * hohe Zahlen sind mehr wert, wenn sie auf Moos liegen, tragen aber eher Kreuze.
 * @type {Record<number, string[]>}
 */
const DECK_TABLE = {
  1: ['b sss', 'g sss', 'y sss', 'r sss', 'g +y'],
  2: ['b ss', 'g ss', 'y ss', 'r ss', 'b +r', 'm s'],
  3: ['b ss', 'g ss', 'y ss', 'r ss', 'b s', 'g ssx', 'y +g', 'r +b'],
  4: ['b s', 'g s', 'y s', 'r s', 'b ss', 'g ssx', 'y ssx', 'r +y', 'm', 'r s'],
  5: ['b s', 'g s', 'y s', 'r s', 'b', 'g', 'y', 'r', 'b ssx', 'y +b', 'm', 'r ssx'],
  6: ['b s', 'g s', 'y s', 'r s', 'b x', 'g', 'y x', 'r +g', 'm', 'y s'],
  7: ['b', 'g', 'y', 'r', 'b sx', 'g +r', 'y x', 'r s'],
  8: ['b x', 'g', 'y x', 'r', 'm x', 'g +b'],
  9: ['b x', 'g x', 'y +r', 'r x', 'm xx']
};

/** @returns {MoosCard[]} Alle 70 Karten in fester Reihenfolge. */
export function createMoosDeck() {
  /** @type {MoosCard[]} */
  const cards = [];
  for (let number = 1; number <= 9; number += 1) {
    DECK_TABLE[number].forEach((code, index) => {
      const [colorCode, symbols = ''] = code.split(' ');
      const bonusCode = symbols.startsWith('+') ? symbols.slice(1) : null;
      cards.push({
        id: `m${number}${String.fromCharCode(97 + index)}`,
        number,
        color: COLOR_CODES[colorCode],
        spirals: bonusCode ? 0 : [...symbols].filter((char) => char === 's').length,
        crosses: bonusCode ? 0 : [...symbols].filter((char) => char === 'x').length,
        bonus: bonusCode ? /** @type {MoosColor} */ (COLOR_CODES[bonusCode]) : null
      });
    });
  }
  return cards;
}

/** @returns {MoosLayout} */
export function emptyLayout() {
  return Array.from({ length: 9 }, () => ({ face: null, moss: null }));
}

/** @param {MoosSlot} slot */
export function isSlotEmpty(slot) {
  return !slot.face && !slot.moss;
}

/** @param {MoosLayout} layout */
export function isComplete(layout) {
  return layout.every((slot) => !isSlotEmpty(slot));
}

/** @param {MoosLayout} layout */
export function filledCount(layout) {
  return layout.filter((slot) => !isSlotEmpty(slot)).length;
}

/**
 * Wohin darf die Karte? Spiegelt die vier Fälle der Regel.
 * @param {MoosLayout} layout
 * @param {MoosCard} card
 * @returns {MoosPlacement}
 */
export function placementOptions(layout, card) {
  const slotIndex = card.number - 1;
  const slot = layout[slotIndex];
  if (isSlotEmpty(slot)) return { kind: 'place', slot: slotIndex };
  if (slot.face && !slot.moss) return { kind: 'choose', slot: slotIndex };
  if (!slot.face && slot.moss) return { kind: 'cover', slot: slotIndex };
  const empty = layout.map((other, index) => (isSlotEmpty(other) ? index : -1)).filter((index) => index >= 0);
  return empty.length ? { kind: 'moss', slots: empty } : { kind: 'discard' };
}

/**
 * Legt die Karte gemäß Regel. Gibt eine neue Auslage zurück oder einen Fehler.
 * @param {MoosLayout} layout
 * @param {MoosCard} card
 * @param {{ slot?: unknown, flipOld?: unknown }} [choice]
 * @returns {{ layout: MoosLayout, result: 'place' | 'cover' | 'flip-new' | 'flip-old' | 'moss' | 'discard', slot: number | null } | { error: string }}
 */
export function applyPlacement(layout, card, choice = {}) {
  const next = layout.map((slot) => ({ ...slot }));
  const option = placementOptions(layout, card);
  switch (option.kind) {
    case 'place':
      next[option.slot].face = card;
      return { layout: next, result: 'place', slot: option.slot };
    case 'cover':
      next[option.slot].face = card;
      return { layout: next, result: 'cover', slot: option.slot };
    case 'choose': {
      if (typeof choice.flipOld !== 'boolean') return { error: 'Wähle, welche Karte zu Moos wird.' };
      const old = /** @type {MoosCard} */ (next[option.slot].face);
      if (choice.flipOld) {
        next[option.slot] = { face: card, moss: old };
        return { layout: next, result: 'flip-old', slot: option.slot };
      }
      next[option.slot] = { face: old, moss: card };
      return { layout: next, result: 'flip-new', slot: option.slot };
    }
    case 'moss': {
      const target = Number(choice.slot);
      if (!option.slots.includes(target)) return { error: 'Lege das Moos auf einen freien Platz.' };
      next[target] = { face: null, moss: card };
      return { layout: next, result: 'moss', slot: target };
    }
    default:
      return { layout: next, result: 'discard', slot: null };
  }
}

/**
 * @param {MoosCard} card
 * @param {MoosColor} color
 */
export function hasColor(card, color) {
  return card.color === color || card.color === 'bunt';
}

/**
 * Größte orthogonal zusammenhängende Gruppe einer Farbe (bunte Geister zählen mit).
 * @param {MoosLayout} layout
 * @returns {{ size: number, color: MoosColor | null, slots: number[] }}
 */
export function largestGroup(layout) {
  /** @type {{ size: number, color: MoosColor | null, slots: number[] }} */
  let best = { size: 0, color: null, slots: [] };
  for (const color of MOOS_COLORS) {
    const seen = new Set();
    for (let start = 0; start < layout.length; start += 1) {
      const startCard = layout[start]?.face;
      if (seen.has(start) || !startCard || !hasColor(startCard, color)) continue;
      const stack = [start];
      /** @type {number[]} */
      const group = [];
      seen.add(start);
      while (stack.length) {
        const index = /** @type {number} */ (stack.pop());
        group.push(index);
        const row = Math.floor(index / 3);
        const col = index % 3;
        const neighbours = [
          row > 0 ? index - 3 : -1,
          row < 2 ? index + 3 : -1,
          col > 0 ? index - 1 : -1,
          col < 2 ? index + 1 : -1
        ];
        for (const neighbour of neighbours) {
          if (neighbour < 0 || seen.has(neighbour)) continue;
          const card = layout[neighbour]?.face;
          if (card && hasColor(card, color)) {
            seen.add(neighbour);
            stack.push(neighbour);
          }
        }
      }
      if (group.length > best.size) best = { size: group.length, color, slots: group.sort((a, b) => a - b) };
    }
  }
  return best;
}

/** @param {number} durchgang */
export function groupMultiplier(durchgang) {
  return Math.min(4, Math.max(2, durchgang + 1));
}

/**
 * @param {MoosLayout} layout
 * @param {number} durchgang 1, 2 oder 3
 * @returns {MoosScore}
 */
export function scoreLayout(layout, durchgang) {
  const faces = layout.map((slot) => slot.face).filter((card) => card !== null);
  let numbers = 0;
  for (const slot of layout) {
    if (slot.face && slot.moss) numbers += slot.face.number;
  }
  const spirals = faces.reduce((sum, card) => sum + card.spirals, 0);
  const crosses = faces.reduce((sum, card) => sum + card.crosses, 0);
  let bonus = 0;
  for (const card of faces) {
    const bonusColor = card.bonus;
    if (bonusColor) bonus += faces.filter((other) => hasColor(other, bonusColor)).length;
  }
  const best = largestGroup(layout);
  const group = best.size * groupMultiplier(durchgang);
  return {
    numbers,
    spirals,
    crosses,
    bonus,
    groupSize: best.size,
    groupColor: best.color,
    group,
    total: numbers + spirals - crosses + bonus + group
  };
}

/** @param {MoosCard} card */
export function moosCardName(card) {
  return `${MOOS_COLOR_NAMES[card.color]} ${card.number}`;
}

/**
 * @typedef {{ text: string, points: number, slots: number[] }} MoosExplainLine
 * @typedef {{ key: 'numbers' | 'symbols' | 'bonus' | 'group', label: string, rule: string, points: number, lines: MoosExplainLine[], slots: number[] }} MoosExplainItem
 */

/**
 * Schlüsselt die Wertung einer Auslage Karte für Karte auf – für „So wird gerechnet“.
 * Die Summe der Punkte entspricht immer `scoreLayout(layout, durchgang).total`.
 * @param {MoosLayout} layout
 * @param {number} durchgang
 * @returns {MoosExplainItem[]}
 */
export function explainLayout(layout, durchgang) {
  const score = scoreLayout(layout, durchgang);
  const faces = layout.map((slot, index) => ({ card: slot.face, index, onMoss: Boolean(slot.moss) })).filter((entry) => entry.card !== null);

  /** @type {MoosExplainLine[]} */
  const numberLines = faces
    .filter((entry) => entry.onMoss)
    .map((entry) => ({ text: `${moosCardName(/** @type {MoosCard} */ (entry.card))} liegt auf Moos`, points: /** @type {MoosCard} */ (entry.card).number, slots: [entry.index] }));

  /** @type {MoosExplainLine[]} */
  const symbolLines = [];
  for (const entry of faces) {
    const card = /** @type {MoosCard} */ (entry.card);
    if (card.spirals) symbolLines.push({ text: `${moosCardName(card)}: ${card.spirals} ${card.spirals === 1 ? 'Spirale' : 'Spiralen'}`, points: card.spirals, slots: [entry.index] });
    if (card.crosses) symbolLines.push({ text: `${moosCardName(card)}: ${card.crosses} ${card.crosses === 1 ? 'Kreuz' : 'Kreuze'}`, points: -card.crosses, slots: [entry.index] });
  }

  /** @type {MoosExplainLine[]} */
  const bonusLines = [];
  for (const entry of faces) {
    const card = /** @type {MoosCard} */ (entry.card);
    const bonusColor = card.bonus;
    if (!bonusColor) continue;
    const matching = faces.filter((other) => hasColor(/** @type {MoosCard} */ (other.card), bonusColor));
    bonusLines.push({
      text: `${moosCardName(card)}: +1 je ${MOOS_COLOR_NAMES[bonusColor]} – ${matching.length} ${matching.length === 1 ? 'Geist' : 'Geister'} (bunte zählen mit)`,
      points: matching.length,
      slots: [entry.index, ...matching.map((other) => other.index).filter((index) => index !== entry.index)]
    });
  }

  const best = largestGroup(layout);
  const multiplier = groupMultiplier(durchgang);
  /** @type {MoosExplainLine[]} */
  const groupLines = best.size
    ? [{ text: `Gruppe ${best.color ? MOOS_COLOR_NAMES[best.color] : ''}: ${best.size} ${best.size === 1 ? 'Geist' : 'Geister'} × ${multiplier} Punkte`, points: best.size * multiplier, slots: best.slots }]
    : [];

  return [
    { key: 'numbers', label: 'Zahlen auf Moos', rule: 'Ein Geist auf Moos bringt seine Zahl. Geister ohne Moos darunter zählen hier nicht.', points: score.numbers, lines: numberLines, slots: numberLines.flatMap((line) => line.slots) },
    { key: 'symbols', label: 'Spiralen und Kreuze', rule: 'Jede Spirale +1, jedes Kreuz −1 – auf allen offenen Geistern.', points: score.spirals - score.crosses, lines: symbolLines, slots: symbolLines.flatMap((line) => line.slots) },
    { key: 'bonus', label: 'Farbbonus', rule: 'Ein Geist mit „+1 je Farbe“ zählt jeden offenen Geist dieser Farbe, auch sich selbst und bunte.', points: score.bonus, lines: bonusLines, slots: [...new Set(bonusLines.flatMap((line) => line.slots))] },
    { key: 'group', label: 'Größte Farbgruppe', rule: `Die größte Gruppe gleichfarbiger, waagerecht oder senkrecht benachbarter Geister. Jeder zählt ${multiplier} (Durchgang ${durchgang}: 2, 3 oder 4 je Durchgang). Bunte zählen zu jeder Farbe.`, points: score.group, lines: groupLines, slots: best.slots }
  ];
}
