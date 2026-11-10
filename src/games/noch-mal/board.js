/**
 * Verrückte Kreuze – Brettgenerator. Jede Runde bekommt ein neues Brett aus zufälligen,
 * zusammenhängenden Farbblöcken (1–6 Felder). Gleichfarbige Blöcke berühren sich nie,
 * jede Farbe hat etwa gleich viele Felder. Server und Client nutzen dieselbe Datei.
 *
 * @typedef {'lime' | 'yellow' | 'blue' | 'pink' | 'peach'} KreuzColor
 * @typedef {'bomb' | 'token' | 'heart'} RowBonus
 * @typedef {{ id: string, row: number, col: number, color: KreuzColor, blockId: number, star: boolean, gold: boolean }} BoardCell
 * @typedef {{ id: number, color: KreuzColor, cells: string[] }} BoardBlock
 * @typedef {{
 *   seed: number,
 *   cols: number,
 *   rows: number,
 *   startCol: number,
 *   letters: string[],
 *   cells: BoardCell[],
 *   blocks: BoardBlock[],
 *   columnPoints: { top: number[], bottom: number[] },
 *   rowBonus: RowBonus[]
 * }} Board
 * @typedef {'klein' | 'normal' | 'gross'} BoardSize
 */

/** @type {KreuzColor[]} */
export const COLORS = ['lime', 'yellow', 'blue', 'pink', 'peach'];

/** @type {Record<BoardSize, { cols: number, rows: number, label: string }>} */
export const BOARD_SIZES = {
  klein: { cols: 11, rows: 5, label: 'Klein' },
  normal: { cols: 15, rows: 7, label: 'Normal' },
  gross: { cols: 19, rows: 9, label: 'Groß' }
};

/** Gewichte für Blockgrößen 1–6. */
const BLOCK_WEIGHTS = [8, 14, 20, 22, 20, 16];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Kleiner, schneller Seed-Zufallsgenerator (mulberry32).
 * @param {number} seed
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} row @param {number} col */
export function cellId(row, col) {
  return `${row}-${col}`;
}

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} random
 */
function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** @param {() => number} random */
function pickBlockSize(random) {
  const total = BLOCK_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  for (let index = 0; index < BLOCK_WEIGHTS.length; index += 1) {
    roll -= BLOCK_WEIGHTS[index];
    if (roll < 0) return index + 1;
  }
  return BLOCK_WEIGHTS.length;
}

/**
 * Punkte je Spalte: symmetrisch, außen am meisten. Bei 15 Spalten entspricht das genau
 * `5 3 3 3 2 2 2 1 …` oben und `3 2 2 2 1 1 1 0 …` unten.
 * @param {number} cols
 */
export function columnPoints(cols) {
  const mid = Math.floor(cols / 2);
  const top = [];
  const bottom = [];
  for (let col = 0; col < cols; col += 1) {
    const distance = Math.abs(col - mid);
    const share = mid === 0 ? 0 : distance / mid;
    const value = distance === 0 ? 1 : share <= 3 / 7 + 1e-9 ? 2 : share < 1 ? 3 : 5;
    top.push(value);
    bottom.push(value === 5 ? 3 : value - 1);
  }
  return { top, bottom };
}

/**
 * Teilt das Raster in zusammenhängende Blöcke (Größe 1–6).
 * @param {number} cols
 * @param {number} rows
 * @param {() => number} random
 * @returns {number[][]} Block-Index je Zelle [row][col]
 */
function partition(cols, rows, random) {
  /** @type {number[][]} */
  const owner = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const order = shuffled(
    Array.from({ length: rows * cols }, (_, index) => index),
    random
  );
  let blockCount = 0;
  for (const start of order) {
    const startRow = Math.floor(start / cols);
    const startCol = start % cols;
    if (owner[startRow][startCol] !== -1) continue;
    const size = pickBlockSize(random);
    const block = blockCount;
    blockCount += 1;
    owner[startRow][startCol] = block;
    /** @type {[number, number][]} */
    const members = [[startRow, startCol]];
    while (members.length < size) {
      /** @type {[number, number][]} */
      const frontier = [];
      for (const [row, col] of members) {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && owner[nr][nc] === -1) frontier.push([nr, nc]);
        }
      }
      if (!frontier.length) break;
      const [nr, nc] = frontier[Math.floor(random() * frontier.length)];
      owner[nr][nc] = block;
      members.push([nr, nc]);
    }
  }

  // Viele Blöcke bleiben beim Wachsen als Einzelfeld stecken. Die meisten gehen im kleinsten
  // Nachbarblock (< 6) auf, damit Einzelfelder selten und besonders bleiben.
  const sizes = new Map();
  for (const block of owner.flat()) sizes.set(block, (sizes.get(block) ?? 0) + 1);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const block = owner[row][col];
      if (sizes.get(block) !== 1 || random() < 0.3) continue;
      let best = -1;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const other = owner[nr][nc];
        if (other !== block && sizes.get(other) < 6 && (best === -1 || sizes.get(other) < sizes.get(best))) best = other;
      }
      if (best === -1) continue;
      owner[row][col] = best;
      sizes.set(best, sizes.get(best) + 1);
      sizes.delete(block);
    }
  }
  // Block-Indizes neu durchnummerieren.
  const remap = new Map();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!remap.has(owner[row][col])) remap.set(owner[row][col], remap.size);
      owner[row][col] = remap.get(owner[row][col]);
    }
  }
  return owner;
}

/**
 * Farben für Blöcke: gleichfarbige Nachbarn sind verboten, jede Farbe soll gleich viele Felder haben.
 * @param {number[][]} owner
 * @param {() => number} random
 * @returns {KreuzColor[] | null}
 */
function colorBlocks(owner, random) {
  const rows = owner.length;
  const cols = owner[0].length;
  const blockCount = Math.max(...owner.flat()) + 1;
  /** @type {Set<number>[]} */
  const neighbours = Array.from({ length: blockCount }, () => new Set());
  const sizes = Array(blockCount).fill(0);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const block = owner[row][col];
      sizes[block] += 1;
      if (row + 1 < rows && owner[row + 1][col] !== block) {
        neighbours[block].add(owner[row + 1][col]);
        neighbours[owner[row + 1][col]].add(block);
      }
      if (col + 1 < cols && owner[row][col + 1] !== block) {
        neighbours[block].add(owner[row][col + 1]);
        neighbours[owner[row][col + 1]].add(block);
      }
    }
  }
  // Große Blöcke zuerst, sonst bleibt am Ende zu wenig Spielraum für den Ausgleich.
  const order = shuffled(Array.from({ length: blockCount }, (_, index) => index), random).sort((a, b) => sizes[b] - sizes[a]);
  /** @type {(KreuzColor | null)[]} */
  const assigned = Array(blockCount).fill(null);
  /** @type {Record<KreuzColor, number>} */
  const counts = { lime: 0, yellow: 0, blue: 0, pink: 0, peach: 0 };
  for (const block of order) {
    const forbidden = new Set([...neighbours[block]].map((other) => assigned[other]).filter(Boolean));
    const options = shuffled(COLORS.filter((color) => !forbidden.has(color)), random);
    if (!options.length) return null;
    options.sort((a, b) => counts[a] - counts[b]);
    assigned[block] = options[0];
    counts[options[0]] += sizes[block];
  }
  const target = (rows * cols) / COLORS.length;
  if (COLORS.some((color) => Math.abs(counts[color] - target) > 2)) return null;
  return /** @type {KreuzColor[]} */ (assigned);
}

/**
 * @param {{ size?: BoardSize, mode?: 'klassisch' | 'erweitert', seed?: number }} [options]
 * @returns {Board}
 */
export function generateBoard(options = {}) {
  const size = BOARD_SIZES[options.size ?? 'normal'] ?? BOARD_SIZES.normal;
  const { cols, rows } = size;
  const extended = options.mode !== 'klassisch';
  const baseSeed = options.seed ?? Math.floor(Math.random() * 2 ** 32);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const seed = (baseSeed + attempt * 7919) >>> 0;
    const random = createRandom(seed);
    const owner = partition(cols, rows, random);
    const blockColors = colorBlocks(owner, random);
    if (!blockColors) continue;

    const startCol = Math.floor(cols / 2);
    /** @type {BoardCell[]} */
    const cells = [];
    /** @type {BoardBlock[]} */
    const blocks = blockColors.map((color, id) => ({ id, color, cells: [] }));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const blockId = owner[row][col];
        const id = cellId(row, col);
        cells.push({ id, row, col, color: blockColors[blockId], blockId, star: false, gold: false });
        blocks[blockId].cells.push(id);
      }
    }
    const at = (/** @type {number} */ row, /** @type {number} */ col) => cells[row * cols + col];

    // Sterne: einer pro Spalte (außer Startspalte), höchstens einer pro Block.
    // Mehrere Versuche mit zufälliger Spaltenreihenfolge, der beste gewinnt.
    /** @type {BoardCell[]} */
    let bestStars = [];
    for (let starTry = 0; starTry < 40 && bestStars.length < cols - 1; starTry += 1) {
      const starBlocks = new Set();
      /** @type {BoardCell[]} */
      const picked = [];
      for (const col of shuffled(Array.from({ length: cols }, (_, index) => index), random)) {
        if (col === startCol) continue;
        const candidates = shuffled(Array.from({ length: rows }, (_, row) => row), random);
        const row = candidates.find((candidate) => !starBlocks.has(at(candidate, col).blockId));
        if (row === undefined) continue;
        picked.push(at(row, col));
        starBlocks.add(at(row, col).blockId);
      }
      if (picked.length > bestStars.length) bestStars = picked;
    }
    if (bestStars.length < cols - 2) continue;
    for (const cell of bestStars) cell.star = true;

    /** @type {RowBonus[]} */
    let rowBonus = [];
    if (extended) {
      // Goldene Würfelfelder: gleichmäßig über die Spalten verteilt, nie auf Sternen oder in der Startspalte.
      const goldCount = Math.max(3, Math.round((cols * rows) / 15));
      const goldCols = Array.from({ length: goldCount }, (_, index) => Math.round(((index + 0.5) * cols) / goldCount - 0.5));
      for (const rawCol of goldCols) {
        const col = rawCol === startCol ? Math.min(cols - 1, rawCol + 1) : rawCol;
        const candidates = shuffled(Array.from({ length: rows }, (_, row) => row), random).filter((row) => !at(row, col).star && !at(row, col).gold);
        if (candidates.length) at(candidates[0], col).gold = true;
      }
      /** @type {RowBonus[]} */
      const pool = [];
      while (pool.length < rows) pool.push(...shuffled(/** @type {RowBonus[]} */ (['bomb', 'token', 'heart']), random));
      rowBonus = pool.slice(0, rows);
    }

    return {
      seed,
      cols,
      rows,
      startCol,
      letters: LETTERS.slice(0, cols),
      cells,
      blocks,
      columnPoints: columnPoints(cols),
      rowBonus
    };
  }
  throw new Error('Konnte kein Spielfeld erzeugen.');
}
