/**
 * Verrückte Kreuze – Regeln, die Server und Client gemeinsam nutzen.
 * Alle Prüfungen bekommen das (pro Runde erzeugte) Brett als Parameter.
 *
 * @typedef {import('./board.js').Board} Board
 * @typedef {import('./board.js').BoardCell} BoardCell
 * @typedef {import('./board.js').KreuzColor} KreuzColor
 * @typedef {'bomb' | 'heart' | 'stars' | 'row' | 'block'} SpecialKind
 * @typedef {{ first: string[], normal: string[] }} Claim
 * @typedef {{ columns: Claim[], rows: Claim[], colors: Record<KreuzColor, Claim> }} Claims
 * @typedef {{
 *   id: string,
 *   checkedCells: string[],
 *   usedJokers: number,
 *   hearts: number,
 *   specialTokens: number,
 *   columnHearts: Record<string, number>
 * }} ScoringPlayer
 * @typedef {{ columns: number, rows: number, colors: number, hearts: number, jokers: number, tokens: number, stars: number, total: number }} ScoreBreakdown
 */

export const JOKERS = 8;
export const MAX_HEARTS = 6;
export const MAX_NUMBER = 5;

/** Seiten des Sonderwürfels. */
/** @type {SpecialKind[]} */
export const SPECIAL_FACES = ['bomb', 'heart', 'stars', 'row', 'block', 'bomb'];

/** @type {Record<SpecialKind, { name: string, hint: string, max: number }>} */
export const SPECIALS = {
  bomb: { name: 'Bombe', hint: 'Bis zu 4 Felder in einem 2×2-Feld, egal welche Farbe und wo.', max: 4 },
  heart: { name: 'Herz', hint: 'Dein Herzbonus für fertige Spalten steigt um 1.', max: 0 },
  stars: { name: 'Sterne', hint: 'Bis zu 2 Sterne, die an deine Kreuze oder die Startspalte grenzen.', max: 2 },
  row: { name: 'Drei in einer Zeile', hint: 'Bis zu 3 Felder in einer Zeile, jedes angebunden.', max: 3 },
  block: { name: 'Farbblock', hint: 'Einen ganzen Farbblock auf einmal, angebunden.', max: 6 }
};

/** @param {Board} board */
export function cellMap(board) {
  return new Map(board.cells.map((cell) => [cell.id, cell]));
}

/** @param {Board} board @param {string} id */
export function neighbourIds(board, id) {
  const [row, col] = id.split('-').map(Number);
  const result = [];
  if (row > 0) result.push(`${row - 1}-${col}`);
  if (row < board.rows - 1) result.push(`${row + 1}-${col}`);
  if (col > 0) result.push(`${row}-${col - 1}`);
  if (col < board.cols - 1) result.push(`${row}-${col + 1}`);
  return result;
}

/** @param {Board} board @param {string[]} ids */
export function isConnected(board, ids) {
  if (ids.length <= 1) return true;
  const set = new Set(ids);
  const seen = new Set([ids[0]]);
  const stack = [ids[0]];
  while (stack.length) {
    const current = /** @type {string} */ (stack.pop());
    for (const next of neighbourIds(board, current)) {
      if (set.has(next) && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen.size === set.size;
}

/**
 * Ein Feld ist angebunden, wenn es in der Startspalte liegt oder an ein Kreuz grenzt.
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {string} id
 */
export function touchesAnchor(board, checked, id) {
  const col = Number(id.split('-')[1]);
  return col === board.startCol || neighbourIds(board, id).some((next) => checked.has(next));
}

/** @param {Board} board @param {Set<string>} checked @param {string[]} ids */
export function isAnchored(board, checked, ids) {
  return ids.some((id) => touchesAnchor(board, checked, id));
}

/**
 * Alle Felder müssen einzeln angebunden sein, neu gewählte Felder zählen dabei schon als Kreuz.
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {string[]} ids
 */
function chainAnchored(board, checked, ids) {
  const accepted = new Set(checked);
  let pending = [...ids];
  let progress = true;
  while (pending.length && progress) {
    progress = false;
    pending = pending.filter((id) => {
      if (touchesAnchor(board, accepted, id)) {
        accepted.add(id);
        progress = true;
        return false;
      }
      return true;
    });
  }
  return pending.length === 0;
}

/**
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {string[]} ids
 * @returns {string}
 */
function basicCellError(board, checked, ids) {
  const map = cellMap(board);
  if (new Set(ids).size !== ids.length) return 'Ein Feld wurde doppelt gewählt.';
  for (const id of ids) {
    if (!map.has(id)) return 'Dieses Feld gibt es nicht.';
    if (checked.has(id)) return 'Dieses Feld ist schon angekreuzt.';
  }
  return '';
}

/**
 * Normaler Zug mit Farbe und Zahl.
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {KreuzColor} color
 * @param {number} number
 * @param {string[]} ids
 * @param {{ partial?: boolean }} [options] partial: Entwurf darf noch zu kurz sein
 */
export function validateCombo(board, checked, color, number, ids, options = {}) {
  const basic = basicCellError(board, checked, ids);
  if (basic) return basic;
  const map = cellMap(board);
  const cells = ids.map((id) => /** @type {BoardCell} */ (map.get(id)));
  if (cells.some((cell) => cell.color !== color)) return 'Alle Felder müssen die gewählte Farbe haben.';
  if (new Set(cells.map((cell) => cell.blockId)).size > 1) return 'Alle Kreuze müssen im selben Farbblock liegen.';
  if (ids.length > number) return `Du darfst nur ${number} ${number === 1 ? 'Feld' : 'Felder'} ankreuzen.`;
  if (!options.partial && ids.length !== number) return `Kreuze genau ${number} ${number === 1 ? 'Feld' : 'Felder'} an.`;
  if (!isConnected(board, ids)) return 'Die Kreuze müssen zusammenhängen.';
  if (ids.length && !isAnchored(board, checked, ids)) {
    return checked.size ? 'Beginne neben einem deiner Kreuze oder in der Startspalte.' : 'Dein erster Zug beginnt in der Startspalte.';
  }
  return '';
}

/**
 * Sonderwürfel-Aktion.
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {SpecialKind} kind
 * @param {string[]} ids
 * @param {{ partial?: boolean }} [options]
 */
export function validateSpecial(board, checked, kind, ids, options = {}) {
  const basic = basicCellError(board, checked, ids);
  if (basic) return basic;
  const map = cellMap(board);
  const cells = ids.map((id) => /** @type {BoardCell} */ (map.get(id)));
  if (kind === 'heart') return ids.length ? 'Das Herz kreuzt keine Felder an.' : '';
  if (!options.partial && ids.length === 0) return 'Wähle mindestens ein Feld.';

  if (kind === 'bomb') {
    if (ids.length > 4) return 'Eine Bombe trifft höchstens 4 Felder.';
    const rowsSpan = Math.max(...cells.map((cell) => cell.row)) - Math.min(...cells.map((cell) => cell.row));
    const colsSpan = Math.max(...cells.map((cell) => cell.col)) - Math.min(...cells.map((cell) => cell.col));
    if (cells.length && (rowsSpan > 1 || colsSpan > 1)) return 'Die Felder müssen in ein 2×2-Feld passen.';
    return '';
  }
  if (kind === 'stars') {
    if (ids.length > 2) return 'Höchstens 2 Sterne.';
    if (cells.some((cell) => !cell.star)) return 'Wähle nur Sternfelder.';
    if (!chainAnchored(board, checked, ids)) return 'Jeder Stern muss an deine Kreuze oder die Startspalte grenzen.';
    return '';
  }
  if (kind === 'row') {
    if (ids.length > 3) return 'Höchstens 3 Felder.';
    if (new Set(cells.map((cell) => cell.row)).size > 1) return 'Alle Felder müssen in derselben Zeile liegen.';
    if (!chainAnchored(board, checked, ids)) return 'Jedes Feld muss an deine Kreuze oder die Startspalte grenzen.';
    return '';
  }
  // Farbblock: alle noch freien Felder eines Blocks.
  if (new Set(cells.map((cell) => cell.blockId)).size > 1) return 'Alle Felder müssen im selben Farbblock liegen.';
  if (!cells.length) return '';
  const block = board.blocks[cells[0].blockId];
  const open = block.cells.filter((id) => !checked.has(id));
  if (!options.partial && open.length !== ids.length) return 'Kreuze den ganzen Farbblock an.';
  if (!isAnchored(board, checked, open)) return 'Der Farbblock muss an deine Kreuze oder die Startspalte grenzen.';
  return '';
}

/**
 * Felder, die man dem Entwurf als Nächstes hinzufügen darf.
 * @param {Board} board
 * @param {Set<string>} checked
 * @param {string[]} draft
 * @param {{ kind: 'combo', color: KreuzColor, number: number } | { kind: 'special', special: SpecialKind } | { kind: 'bonus-bomb' }} action
 */
export function selectableCells(board, checked, draft, action) {
  /** @type {Set<string>} */
  const result = new Set();
  const map = cellMap(board);
  for (const cell of board.cells) {
    if (checked.has(cell.id) || draft.includes(cell.id)) continue;
    const candidate = [...draft, cell.id];
    const error = action.kind === 'combo'
      ? validateCombo(board, checked, action.color, action.number, candidate, { partial: true })
      : validateSpecial(board, checked, action.kind === 'special' ? action.special : 'bomb', candidate, { partial: true });
    if (error) continue;
    // Nur anbieten, wenn der Zug von hier aus auch fertig werden kann: Im Block müssen
    // zusammenhängend genug freie Felder liegen.
    if (action.kind === 'combo' && reachableOpen(board, map, checked, cell, candidate) < action.number) continue;
    result.add(cell.id);
  }
  return result;
}

/**
 * Größe des freien, zusammenhängenden Bereichs im Block einer Zelle (der Entwurf zählt mit).
 * @param {Board} board
 * @param {Map<string, BoardCell>} map
 * @param {Set<string>} checked
 * @param {BoardCell} start
 * @param {string[]} draft
 */
function reachableOpen(board, map, checked, start, draft) {
  const inDraft = new Set(draft);
  const seen = new Set([start.id]);
  const stack = [start.id];
  while (stack.length) {
    const current = /** @type {string} */ (stack.pop());
    for (const next of neighbourIds(board, current)) {
      if (seen.has(next)) continue;
      const cell = map.get(next);
      if (!cell || cell.blockId !== start.blockId) continue;
      if (checked.has(next) && !inDraft.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen.size;
}

/** @param {Board} board @param {Set<string>} checked @param {number} col */
export function isColumnDone(board, checked, col) {
  for (let row = 0; row < board.rows; row += 1) if (!checked.has(`${row}-${col}`)) return false;
  return true;
}

/** @param {Board} board @param {Set<string>} checked @param {number} row */
export function isRowDone(board, checked, row) {
  for (let col = 0; col < board.cols; col += 1) if (!checked.has(`${row}-${col}`)) return false;
  return true;
}

/** @param {Board} board @param {Set<string>} checked @param {KreuzColor} color */
export function isColorDone(board, checked, color) {
  return board.cells.every((cell) => cell.color !== color || checked.has(cell.id));
}

/** @param {Board} board @param {Set<string>} checked */
export function completedColorCount(board, checked) {
  return /** @type {KreuzColor[]} */ (['lime', 'yellow', 'blue', 'pink', 'peach']).filter((color) => isColorDone(board, checked, color)).length;
}

/** @param {Board} board @returns {Claims} */
export function emptyClaims(board) {
  return {
    columns: Array.from({ length: board.cols }, () => ({ first: [], normal: [] })),
    rows: Array.from({ length: board.rows }, () => ({ first: [], normal: [] })),
    colors: { lime: { first: [], normal: [] }, yellow: { first: [], normal: [] }, blue: { first: [], normal: [] }, pink: { first: [], normal: [] }, peach: { first: [], normal: [] } }
  };
}

/**
 * @param {Board} board
 * @param {ScoringPlayer} player
 * @param {Claims} claims
 * @param {boolean} extended
 * @returns {ScoreBreakdown}
 */
export function scorePlayer(board, player, claims, extended) {
  const checked = new Set(player.checkedCells);
  let columns = 0;
  claims.columns.forEach((claim, col) => {
    if (claim.first.includes(player.id)) columns += board.columnPoints.top[col];
    else if (claim.normal.includes(player.id)) columns += board.columnPoints.bottom[col];
  });
  let rows = 0;
  if (extended) {
    // Zeilen: nur wer zuerst fertig ist, bekommt die 5 Punkte. Spätere bekommen nur den Bonus.
    claims.rows.forEach((claim) => {
      if (claim.first.includes(player.id)) rows += 5;
    });
  }
  let colors = 0;
  for (const claim of Object.values(claims.colors)) {
    if (claim.first.includes(player.id)) colors += 5;
    else if (claim.normal.includes(player.id)) colors += 3;
  }
  const hearts = extended ? Object.values(player.columnHearts ?? {}).reduce((sum, value) => sum + value, 0) : 0;
  const jokers = JOKERS - player.usedJokers;
  const tokens = extended ? player.specialTokens * 2 : 0;
  const stars = -2 * board.cells.filter((cell) => cell.star && !checked.has(cell.id)).length;
  return { columns, rows, colors, hearts, jokers, tokens, stars, total: columns + rows + colors + hearts + jokers + tokens + stars };
}
