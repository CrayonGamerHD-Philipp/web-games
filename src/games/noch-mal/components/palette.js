/** Farben und Formen des Spielmaterials. Jede Farbe hat zusätzlich ein Formsymbol. */

/** @type {Record<string, { name: string, fill: string, ink: string, shape: 'circle' | 'triangle' | 'square' | 'diamond' | 'drop' }>} */
export const PALETTE = {
  lime: { name: 'Grün', fill: '#79b84a', ink: '#24420f', shape: 'circle' },
  yellow: { name: 'Gelb', fill: '#f1c232', ink: '#4d3a00', shape: 'triangle' },
  blue: { name: 'Blau', fill: '#4a90d9', ink: '#0d2c52', shape: 'square' },
  pink: { name: 'Pink', fill: '#e2669b', ink: '#4f0f2c', shape: 'diamond' },
  peach: { name: 'Orange', fill: '#f08a43', ink: '#4f2205', shape: 'drop' }
};

/** SVG-Pfad je Form, in einem 0–10 Raster. */
export const SHAPE_PATHS = {
  circle: 'M5 1.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z',
  triangle: 'M5 1.4 8.8 8.4H1.2Z',
  square: 'M1.8 1.8h6.4v6.4H1.8Z',
  diamond: 'M5 1 9 5 5 9 1 5Z',
  drop: 'M5 1.2C6.6 3.4 8.4 5 8.4 6.6A3.4 3.4 0 0 1 1.6 6.6C1.6 5 3.4 3.4 5 1.2Z'
};

/** @type {Record<string, { name: string, short: string }>} */
export const SPECIAL_LABELS = {
  bomb: { name: 'Bombe', short: 'Bombe' },
  heart: { name: 'Herz', short: 'Herz' },
  stars: { name: 'Sterne', short: 'Sterne' },
  row: { name: 'Drei in einer Zeile', short: '3 in Zeile' },
  block: { name: 'Farbblock', short: 'Block' }
};

/** @type {Record<string, string>} */
export const ROW_BONUS_LABELS = { bomb: 'Bonusbombe', token: 'Sonderwürfel-Marke', heart: 'Herz' };
