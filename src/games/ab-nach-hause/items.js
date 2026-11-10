/**
 * Ab nach Hause – optionale Items und Glücksfelder (geteilt von Server und Client).
 *
 * Wer einen Zug auf einem Glücksfeld beendet, bekommt ein Item (höchstens 2 auf der Hand).
 * Wer hinten liegt, bekommt eher starke Items – so bleibt es bis zum Schluss spannend.
 *
 * @typedef {'wish' | 'turbo' | 'reroll' | 'shield' | 'storm' | 'trap'} HeimItem
 * @typedef {'roll' | 'move'} HeimPhase
 */

export const MAX_ITEMS = 2;
export const TURBO_BONUS = 3;
export const STORM_STEPS = 5;

/** Glücksfelder auf der Bahn (Bahnindex 0–39), nie auf einem Startfeld. */
export const BOX_FIELDS = [3, 7, 13, 17, 23, 27, 33, 37];

/**
 * @type {Record<HeimItem, { name: string, hint: string, phases: HeimPhase[] }>}
 */
export const ITEMS = {
  wish: { name: 'Wunschwürfel', hint: 'Statt zu würfeln bestimmst du die Augenzahl selbst.', phases: ['roll'] },
  turbo: { name: 'Turbo', hint: `Nach dem Würfeln: Dein Zug geht ${TURBO_BONUS} Felder weiter.`, phases: ['move'] },
  reroll: { name: 'Neu würfeln', hint: 'Nach dem Würfeln: Wirf noch einmal, der neue Wurf zählt.', phases: ['move'] },
  shield: { name: 'Schutzschild', hint: 'Bis zu deinem nächsten Zug kann dich niemand schlagen.', phases: ['roll', 'move'] },
  storm: { name: 'Gewitter', hint: `Die vorderste Figur des Führenden muss ${STORM_STEPS} Felder zurück.`, phases: ['roll', 'move'] },
  trap: { name: 'Falle', hint: 'Liegt hinter deiner vordersten Figur. Wer dort landet, muss zurück in die Basis.', phases: ['roll', 'move'] }
};

/**
 * Gewichte je Item. `behind` ist 0 für den Führenden und 1 für den Letzten.
 * @param {number} behind
 * @returns {[HeimItem, number][]}
 */
export function itemWeights(behind) {
  return [
    ['wish', 1 + 4 * behind],
    ['turbo', 2 + 3 * behind],
    ['reroll', 4],
    ['shield', 4 - 2 * behind],
    ['storm', 0.5 + 4 * behind],
    ['trap', 3 - behind]
  ];
}

/**
 * @param {number} behind
 * @param {() => number} [random]
 * @returns {HeimItem}
 */
export function drawItem(behind, random = Math.random) {
  const weights = itemWeights(behind);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = random() * total;
  for (const [item, weight] of weights) {
    pick -= weight;
    if (pick < 0) return item;
  }
  return weights[weights.length - 1][0];
}
