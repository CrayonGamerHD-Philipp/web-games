/**
 * Ab nach Hause – Brettgeometrie (geteilt von Server und Client).
 *
 * Das Brett ist ein 11×11-Raster. Koordinaten sind `[row, col]` (0-basiert).
 * Die Laufbahn hat 40 Felder und läuft im Uhrzeigersinn. Jeder Sitz hat ein
 * Startfeld auf der Bahn, 4 Basisfelder in seiner Ecke und 4 Zielfelder
 * („Zuhause“), die vom Feld vor dem Startfeld zur Mitte führen.
 *
 * Fortschritt einer Figur (`progress`):
 *   -1       → in der Basis
 *   0 … 39   → auf der Bahn, so viele Felder hinter dem eigenen Startfeld
 *   40 … 43  → im Zuhause (40 = erstes, 43 = innerstes Feld)
 */

export const GRID = 11;
export const TRACK_LENGTH = 40;
export const PIECES_PER_PLAYER = 4;
export const BASE = -1;
export const HOME_START = TRACK_LENGTH;
export const HOME_END = TRACK_LENGTH + PIECES_PER_PLAYER - 1;

/** Bahnfelder im Uhrzeigersinn, Index 0 = Startfeld von Sitz 0. @type {[number, number][]} */
export const TRACK = [
  [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 5],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
  [4, 7], [4, 8], [4, 9], [4, 10],
  [5, 10],
  [6, 10], [6, 9], [6, 8], [6, 7], [6, 6],
  [7, 6], [8, 6], [9, 6], [10, 6],
  [10, 5],
  [10, 4], [9, 4], [8, 4], [7, 4], [6, 4],
  [6, 3], [6, 2], [6, 1], [6, 0],
  [5, 0]
];

/**
 * Sitze im Uhrzeigersinn: links oben, rechts oben, rechts unten, links unten.
 * @type {{ start: number, base: [number, number][], home: [number, number][] }[]}
 */
export const SEATS = [
  {
    start: 0,
    base: [[1, 1], [1, 2], [2, 1], [2, 2]],
    home: [[5, 1], [5, 2], [5, 3], [5, 4]]
  },
  {
    start: 10,
    base: [[1, 8], [1, 9], [2, 8], [2, 9]],
    home: [[1, 5], [2, 5], [3, 5], [4, 5]]
  },
  {
    start: 20,
    base: [[8, 8], [8, 9], [9, 8], [9, 9]],
    home: [[5, 9], [5, 8], [5, 7], [5, 6]]
  },
  {
    start: 30,
    base: [[8, 1], [8, 2], [9, 1], [9, 2]],
    home: [[9, 5], [8, 5], [7, 5], [6, 5]]
  }
];

/** Sitzverteilung je Spielerzahl (bei 2 Spielern gegenüber). @type {Record<number, number[]>} */
export const SEAT_LAYOUT = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3]
};

/**
 * Bahnindex (0–39) einer Figur, oder -1 wenn sie nicht auf der Bahn steht.
 * @param {number} seat
 * @param {number} progress
 */
export function trackIndexOf(seat, progress) {
  if (progress < 0 || progress >= TRACK_LENGTH) return -1;
  return (SEATS[seat].start + progress) % TRACK_LENGTH;
}

/**
 * Rasterposition einer Figur.
 * @param {number} seat
 * @param {number} progress
 * @param {number} pieceIndex
 * @returns {[number, number]}
 */
export function cellOf(seat, progress, pieceIndex) {
  const layout = SEATS[seat];
  if (progress < 0) return layout.base[pieceIndex];
  if (progress >= TRACK_LENGTH) return layout.home[progress - TRACK_LENGTH];
  return TRACK[(layout.start + progress) % TRACK_LENGTH];
}
