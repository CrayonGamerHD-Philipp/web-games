// Gemeinsame Hilfen für Schnell-Reaktionen in der Oberfläche.

/** @typedef {{ id: string, playerId: string, emoji: string, at: number }} Reaction */

/** Vorlesbare Namen der Reaktionen (für aria-label). */
export const REACTION_LABELS = /** @type {Record<string, string>} */ ({
  '👍': 'Daumen hoch',
  '👏': 'Applaus',
  '😂': 'Lachen',
  '😮': 'Staunen',
  '😍': 'Begeistert',
  '🔥': 'Feuer',
  '😭': 'Weinen',
  '🎉': 'Feiern'
});

/** So lange (ms) schwebt eine Blase sichtbar über dem Avatar (Client-Uhr). */
export const BUBBLE_MS = 3000;
