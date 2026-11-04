/**
 * Vier in einer Reihe – zwei Spieler lassen abwechselnd Scheiben in ein
 * aufrechtes Gitter (7 Spalten × 6 Reihen) fallen. Vier gleiche in einer
 * Linie (waagerecht, senkrecht, diagonal) gewinnen; volles Brett = Remis.
 *
 * Brett: 42 Felder, Index = row * COLUMNS + column, Reihe 0 ist oben.
 * Ein Feld enthält den Sitz (0 | 1) des Spielers oder null.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {0 | 1} VierSeat
 * @typedef {{ id: string, name: string, seat: VierSeat }} VierPlayer
 * @typedef {{ index: number, column: number, row: number, playerId: string, seat: VierSeat }} VierLastMove
 * @typedef {{ seq: number, type: 'start' | 'drop' | 'win' | 'draw', playerId: string | null, text: string, column?: number, row?: number }} VierEvent
 * @typedef {{
 *   board: (VierSeat | null)[],
 *   currentPlayerId: string | null,
 *   startPlayerId: string,
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   winningLine: number[],
 *   lastMove: VierLastMove | null,
 *   moveCount: number,
 *   lastEvent: VierEvent
 * }} VierState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: VierPlayer[], state: VierState }} VierSession
 * @typedef {{ type?: unknown, column?: unknown }} VierMove
 */

export const vierInEinerReiheGame = {
  id: 'vier-in-einer-reihe',
  name: 'Vier in einer Reihe',
  description: 'Scheiben fallen nach unten: Wer zuerst vier in einer Linie hat – waagerecht, senkrecht oder schräg – gewinnt.',
  previewImage: '/images/vier-in-einer-reihe-scene.webp',
  minPlayers: 2,
  maxPlayers: 2
};

export const COLUMNS = 7;
export const ROWS = 6;
export const CELLS = COLUMNS * ROWS;

/** Richtungen [dRow, dCol]: waagerecht, senkrecht, fallend, steigend. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];

/**
 * @param {BasicPlayer[]} players
 * @param {{ previousStarterId?: unknown }} [options]
 * @returns {VierSession | { error: string }}
 */
export function createVierInEinerReiheSession(players, options = {}) {
  const selected = Array.isArray(players) ? players.slice(0, 2) : [];
  if (selected.length < 2) {
    return { error: 'Vier in einer Reihe braucht genau zwei Spieler.' };
  }

  const previous = typeof options?.previousStarterId === 'string' ? options.previousStarterId : null;
  const starter =
    previous && selected.some((player) => player.id === previous)
      ? /** @type {BasicPlayer} */ (selected.find((player) => player.id !== previous))
      : selected[Math.random() < 0.5 ? 0 : 1];

  /** @type {VierSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: vierInEinerReiheGame.id,
    name: vierInEinerReiheGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player, index) => ({ id: player.id, name: player.name, seat: /** @type {VierSeat} */ (index) })),
    state: {
      board: Array(CELLS).fill(null),
      currentPlayerId: starter.id,
      startPlayerId: starter.id,
      winnerId: null,
      isDraw: false,
      winningLine: [],
      lastMove: null,
      moveCount: 0,
      lastEvent: { seq: 0, type: 'start', playerId: starter.id, text: `${starter.name} beginnt.` }
    }
  };
  return session;
}

/**
 * Lowest free row in a column, or -1 if the column is full.
 * @param {(VierSeat | null)[]} board
 * @param {number} column
 */
export function landingRow(board, column) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row * COLUMNS + column] === null) return row;
  }
  return -1;
}

/**
 * All cells of runs of ≥ 4 through (row, column) for the given seat.
 * @param {(VierSeat | null)[]} board
 * @param {number} row
 * @param {number} column
 * @param {VierSeat} seat
 */
function linesThrough(board, row, column, seat) {
  /** @type {Set<number>} */
  const cells = new Set();
  for (const [dr, dc] of DIRECTIONS) {
    const run = [row * COLUMNS + column];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && board[r * COLUMNS + c] === seat) {
        run.push(r * COLUMNS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= 4) run.forEach((cell) => cells.add(cell));
  }
  return [...cells].sort((a, b) => a - b);
}

/**
 * @param {VierSession} session
 * @param {string} playerId
 * @param {VierMove} move
 * @returns {{ session: VierSession } | { error: string }}
 */
export function makeVierInEinerReiheMove(session, playerId, move) {
  if (!session || session.status !== 'running') {
    return { error: 'Diese Partie ist bereits beendet.' };
  }
  const state = session.state;
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return { error: 'Du schaust in dieser Runde nur zu.' };
  }
  if (state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }
  if (!move || typeof move !== 'object' || move.type !== 'drop') {
    return { error: 'Unbekannter Zug.' };
  }
  const column = move.column;
  if (typeof column !== 'number' || !Number.isInteger(column) || column < 0 || column >= COLUMNS) {
    return { error: 'Diese Spalte gibt es nicht.' };
  }
  const row = landingRow(state.board, column);
  if (row === -1) {
    return { error: 'Diese Spalte ist schon voll.' };
  }

  const index = row * COLUMNS + column;
  state.board[index] = player.seat;
  state.moveCount += 1;
  state.lastMove = { index, column, row, playerId, seat: player.seat };
  const seq = (state.lastEvent?.seq ?? 0) + 1;

  const line = linesThrough(state.board, row, column, player.seat);
  if (line.length) {
    session.status = 'finished';
    state.winnerId = playerId;
    state.winningLine = line;
    state.currentPlayerId = null;
    state.lastEvent = { seq, type: 'win', playerId, column, row, text: `${player.name} hat vier in einer Reihe.` };
    return { session };
  }

  if (state.moveCount >= CELLS) {
    session.status = 'finished';
    state.isDraw = true;
    state.currentPlayerId = null;
    state.lastEvent = { seq, type: 'draw', playerId, column, row, text: 'Das Brett ist voll – unentschieden.' };
    return { session };
  }

  const next = session.players.find((candidate) => candidate.id !== playerId);
  state.currentPlayerId = next?.id ?? playerId;
  state.lastEvent = { seq, type: 'drop', playerId, column, row, text: `${player.name} setzt in Spalte ${column + 1}.` };
  return { session };
}
