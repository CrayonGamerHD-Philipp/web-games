// @ts-check
import { createGame, rollCurrentDice, selectDice, selectCells, confirmMove, clearPendingMove, skipMove } from './logic/gameState.ts';

/** @typedef {{ id: string, name: string }} BasicPlayer */
/** @typedef {import('./types.ts').CellColor} CellColor */
/** @typedef {import('./types.ts').NochMalGameState & { winnerId?: string | null, isDraw?: boolean, roundScores?: { playerId: string, score: number }[] }} ExposedState */
/** @typedef {{ id: string, gameId: string, name: string, status: string, createdAt: string, players: BasicPlayer[], state: ExposedState }} NochMalSession */
/** @typedef {{ type?: unknown, colorDieId?: unknown, numberDieId?: unknown, colorChoice?: unknown, numberChoice?: unknown, cellIds?: unknown }} NochMalMove */

export const nochMalSoGutGame = {
  id: 'noch-mal-so-gut',
  name: 'Noch mal so gut',
  description: 'Eigenstaendiges Roll-and-Write mit Farbgruppen, Jokern, Spezialwuerfel und Wertungsleisten.',
  previewImage: '/images/party-hero.png',
  minPlayers: 1,
  maxPlayers: 6
};

/** @param {import('./types.ts').NochMalGameState} state @returns {ExposedState} */
function exposeEndFields(state) {
  const winnerIds = state.winnerIds ?? [];
  return {
    ...state,
    winnerId: winnerIds.length === 1 ? winnerIds[0] : null,
    isDraw: state.phase === 'finished' && winnerIds.length !== 1,
    roundScores: state.players.map((player) => ({ playerId: player.id, score: player.score.total }))
  };
}

/** @param {import('./types.ts').NochMalGameState} state @returns {NochMalSession} */
function makeSession(state) {
  return {
    id: crypto.randomUUID(),
    gameId: nochMalSoGutGame.id,
    name: nochMalSoGutGame.name,
    status: state.phase === 'finished' ? 'finished' : 'running',
    createdAt: new Date().toISOString(),
    players: state.players.map((player) => ({ id: player.id, name: player.name })),
    state: exposeEndFields(state)
  };
}

/** @param {BasicPlayer[]} players */
export function createNochMalSoGutSession(players) {
  const selectedPlayers = players.slice(0, nochMalSoGutGame.maxPlayers);
  if (selectedPlayers.length < nochMalSoGutGame.minPlayers) {
    return { error: 'Noch mal so gut braucht mindestens einen Spieler.' };
  }

  const state = createGame({
    playerCount: selectedPlayers.length,
    playerNames: selectedPlayers.map((player) => player.name)
  });

  state.players = state.players.map((player, index) => ({
    ...player,
    id: selectedPlayers[index].id,
    name: selectedPlayers[index].name
  }));

  return makeSession(state);
}

/** @param {NochMalSession} session */
function activeState(session) {
  return session.state;
}

/** @param {NochMalSession} session @param {import('./types.ts').NochMalGameState} state */
function finishSession(session, state) {
  session.state = exposeEndFields(state);
  session.players = state.players.map((player) => ({ id: player.id, name: player.name }));
  session.status = state.phase === 'finished' ? 'finished' : 'running';
  return { session };
}

/** @param {NochMalSession} session @param {string} playerId @param {NochMalMove} move */
export function makeNochMalSoGutMove(session, playerId, move) {
  if (session.status !== 'running') return { error: 'Dieses Spiel ist bereits beendet.' };
  const state = activeState(session);
  const actingPlayer = state.players[state.actingPlayerIndex];
  if (!actingPlayer || actingPlayer.id !== playerId) return { error: 'Du bist in dieser Runde nicht am Zug.' };

  if (move.type === 'roll') {
    if (state.phase !== 'rolling') return { error: 'Jetzt kann nicht gewuerfelt werden.' };
    return finishSession(session, rollCurrentDice(state));
  }

  if (move.type === 'select-dice') {
    const next = selectDice(state, String(move.colorDieId ?? ''), String(move.numberDieId ?? ''), {
      colorChoice: /** @type {CellColor | undefined} */ (move.colorChoice),
      numberChoice: Number(move.numberChoice ?? 1)
    });
    if (!next.selectedDice) return { error: 'Diese Wuerfelkombination ist nicht verfuegbar.' };
    return finishSession(session, next);
  }

  if (move.type === 'select-cells') {
    const cellIds = Array.isArray(move.cellIds) ? move.cellIds.map(String) : [];
    return finishSession(session, selectCells(state, cellIds));
  }

  if (move.type === 'confirm') return finishSession(session, confirmMove(state));
  if (move.type === 'clear') return finishSession(session, clearPendingMove(state));
  if (move.type === 'skip') return finishSession(session, skipMove(state));

  return { error: 'Diese Aktion ist nicht bekannt.' };
}
