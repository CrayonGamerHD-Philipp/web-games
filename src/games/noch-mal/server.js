/**
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {{ checkedCells: string[], usedJokers: number[], currentPlayerId: string | null, winnerId: string | null, isDraw: boolean, roundScores: { playerId: string, score: number }[] }} NochMalState
 * @typedef {{ id: string, gameId: 'noch-mal', name: string, status: 'running' | 'finished', createdAt: string, players: BasicPlayer[], state: NochMalState }} NochMalSession
 * @typedef {{ type?: unknown, cellId?: unknown, jokerIndex?: unknown }} NochMalMove
 */

export const nochMalGame = {
  id: 'noch-mal',
  name: 'Noch mal',
  description: 'Ein simples digitales Spielblatt zum Markieren von Feldern, Jokern und Punkten.',
  minPlayers: 1,
  maxPlayers: 6
};

/** @param {BasicPlayer[]} players @returns {NochMalSession | { error: string }} */
export function createNochMalSession(players) {
  const selectedPlayers = players.slice(0, nochMalGame.maxPlayers);

  if (selectedPlayers.length < nochMalGame.minPlayers) {
    return { error: 'Noch mal braucht mindestens einen Spieler.' };
  }

  return {
    id: crypto.randomUUID(),
    gameId: 'noch-mal',
    name: nochMalGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selectedPlayers,
    state: {
      checkedCells: [],
      usedJokers: [],
      currentPlayerId: selectedPlayers[0]?.id ?? null,
      winnerId: null,
      isDraw: false,
      roundScores: []
    }
  };
}

/** @param {NochMalSession} session @param {string} _playerId @param {NochMalMove} move */
export function makeNochMalMove(session, _playerId, move) {
  if (session.status !== 'running') {
    return { error: 'Dieses Spielblatt ist nicht mehr aktiv.' };
  }

  const type = String(move.type ?? '');

  if (type === 'toggle-cell') {
    const cellId = String(move.cellId ?? '');
    if (!/^\d+-\d+$/.test(cellId)) return { error: 'Dieses Feld ist ungueltig.' };

    session.state.checkedCells = session.state.checkedCells.includes(cellId)
      ? session.state.checkedCells.filter((id) => id !== cellId)
      : [...session.state.checkedCells, cellId];
    return { session };
  }

  if (type === 'toggle-joker') {
    const jokerIndex = Number(move.jokerIndex);
    if (!Number.isInteger(jokerIndex) || jokerIndex < 0 || jokerIndex >= 8) return { error: 'Dieser Joker ist ungueltig.' };

    session.state.usedJokers = session.state.usedJokers.includes(jokerIndex)
      ? session.state.usedJokers.filter((index) => index !== jokerIndex)
      : [...session.state.usedJokers, jokerIndex];
    return { session };
  }

  if (type === 'reset') {
    session.state.checkedCells = [];
    session.state.usedJokers = [];
    return { session };
  }

  return { error: 'Diese Noch-mal-Aktion ist nicht bekannt.' };
}
