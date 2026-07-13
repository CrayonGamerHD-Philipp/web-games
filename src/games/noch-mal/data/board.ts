import type { NochMalColor } from '../types';

export const letters = 'ABCDEFGHIJKLMNO'.split('');

export const rows: NochMalColor[][] = [
  ['lime', 'lime', 'lime', 'yellow', 'yellow', 'yellow', 'yellow', 'lime', 'blue', 'blue', 'blue', 'peach', 'yellow', 'yellow', 'yellow'],
  ['peach', 'lime', 'yellow', 'lime', 'yellow', 'yellow', 'peach', 'peach', 'pink', 'blue', 'blue', 'peach', 'peach', 'lime', 'lime'],
  ['blue', 'lime', 'pink', 'lime', 'lime', 'lime', 'lime', 'pink', 'pink', 'pink', 'yellow', 'yellow', 'peach', 'lime', 'lime'],
  ['blue', 'pink', 'pink', 'lime', 'peach', 'peach', 'blue', 'blue', 'lime', 'lime', 'yellow', 'yellow', 'peach', 'pink', 'blue'],
  ['pink', 'peach', 'peach', 'peach', 'peach', 'pink', 'blue', 'blue', 'peach', 'peach', 'peach', 'pink', 'pink', 'pink', 'pink'],
  ['pink', 'blue', 'blue', 'pink', 'pink', 'pink', 'pink', 'yellow', 'yellow', 'peach', 'pink', 'blue', 'blue', 'blue', 'peach'],
  ['yellow', 'yellow', 'blue', 'blue', 'blue', 'blue', 'pink', 'yellow', 'yellow', 'yellow', 'lime', 'lime', 'lime', 'peach', 'peach']
];

export const stars = new Set(['0-7', '1-2', '1-4', '1-9', '2-0', '2-6', '3-5', '3-13', '5-1', '5-3', '5-8', '5-10', '5-14', '6-12']);
export const topScore = [5, 3, 3, 3, 2, 2, 2, 1, 2, 2, 2, 3, 3, 3, 5];
export const bottomScore = [3, 2, 2, 2, 1, 1, 1, 0, 1, 1, 1, 2, 2, 2, 3];
export const jokerCount = 8;

export const cells = rows.flatMap((row, rowIndex) =>
  row.map((color, columnIndex) => ({
    id: `${rowIndex}-${columnIndex}`,
    row: rowIndex,
    column: columnIndex,
    color,
    hasStar: stars.has(`${rowIndex}-${columnIndex}`)
  }))
);
