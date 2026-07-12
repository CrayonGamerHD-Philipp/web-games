/**
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {{ id: string, name: string, mark: string }} TicTacToePlayer
 * @typedef {{ board: (string | null)[], currentPlayerId: string | null, winnerId: string | null, winningLine: number[], isDraw: boolean }} TicTacToeState
 * @typedef {{ id: string, gameId: string, name: string, status: string, createdAt: string, players: TicTacToePlayer[], state: TicTacToeState }} TicTacToeSession
 */

export const ticTacToeGame = {
  id: 'tic-tac-toe',
  name: 'Tic Tac Toe',
  description: 'Klassisches Drei-gewinnt fuer zwei Spieler.',
  previewImage: '/images/tic-tac-toe-scene.png',
  minPlayers: 2,
  maxPlayers: 2
};

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

/**
 * @param {BasicPlayer[]} players
 * @returns {TicTacToeSession | { error: string }}
 */
export function createTicTacToeSession(players) {
  const selectedPlayers = players.slice(0, 2);

  if (selectedPlayers.length < ticTacToeGame.minPlayers) {
    return { error: 'Tic Tac Toe braucht mindestens zwei Spieler.' };
  }

  /** @type {TicTacToeSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: ticTacToeGame.id,
    name: ticTacToeGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selectedPlayers.map((player, index) => ({
      id: player.id,
      name: player.name,
      mark: index === 0 ? 'X' : 'O'
    })),
    state: {
      board: Array(9).fill(null),
      currentPlayerId: selectedPlayers[0].id,
      winnerId: null,
      winningLine: [],
      isDraw: false
    }
  };

  return session;
}

/**
 * @param {TicTacToeSession} session
 * @param {string} playerId
 * @param {unknown} cellIndex
 */
export function makeTicTacToeMove(session, playerId, cellIndex) {
  if (session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }

  const index = Number(cellIndex);

  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { error: 'Dieses Feld ist ungueltig.' };
  }

  const player = session.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return { error: 'Du spielst in dieser Runde nur als Zuschauer mit.' };
  }

  if (session.state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }

  if (session.state.board[index]) {
    return { error: 'Dieses Feld ist bereits belegt.' };
  }

  session.state.board[index] = player.mark;
  const winningLine = winningLines.find((line) => line.every((cell) => session.state.board[cell] === player.mark));

  if (winningLine) {
    session.status = 'finished';
    session.state.winnerId = player.id;
    session.state.winningLine = winningLine;
    return { session };
  }

  if (session.state.board.every(Boolean)) {
    session.status = 'finished';
    session.state.isDraw = true;
    return { session };
  }

  const nextPlayer = session.players.find((candidate) => candidate.id !== playerId);
  session.state.currentPlayerId = nextPlayer?.id ?? playerId;

  return { session };
}

