import { createNochMalSoGutSession, makeNochMalSoGutMove, nochMalSoGutGame } from '../../../games/noch-mal-so-gut/server.js';
import { createSkyjoSession, makeSkyjoMove, skyjoGame } from '../../../games/skyjo/server.js';
import { createTicTacToeSession, makeTicTacToeMove, ticTacToeGame } from '../../../games/tic-tac-toe/server.js';

const gameHandlers = [
  {
    definition: ticTacToeGame,
    createSession: createTicTacToeSession,
    /**
     * @param {unknown} session
     * @param {string} playerId
     * @param {{ cellIndex?: unknown }} move
     */
    applyMove: (session, playerId, move) =>
      makeTicTacToeMove(
        /** @type {Exclude<ReturnType<typeof createTicTacToeSession>, { error: string }>} */ (session),
        playerId,
        move.cellIndex
      )
  },
  {
    definition: skyjoGame,
    createSession: createSkyjoSession,
    /**
     * @param {unknown} session
     * @param {string} playerId
     * @param {{ type?: unknown, cardIndex?: unknown, source?: unknown }} move
     */
    applyMove: (session, playerId, move) =>
      makeSkyjoMove(
        /** @type {Exclude<ReturnType<typeof createSkyjoSession>, { error: string }>} */ (session),
        playerId,
        move
      )
  },
  {
    definition: nochMalSoGutGame,
    createSession: createNochMalSoGutSession,
    applyMove: makeNochMalSoGutMove
  }
];

export const availableGames = gameHandlers.map((handler) => handler.definition);

/** @param {unknown} gameId */
function getGameHandler(gameId) {
  return gameHandlers.find((handler) => handler.definition.id === gameId) ?? null;
}

/** @param {unknown} gameId */
export function getGame(gameId) {
  return getGameHandler(gameId)?.definition ?? null;
}

/**
 * @param {unknown} gameId
 * @param {{ id: string, name: string }[]} players
 */
export function createGameSession(gameId, players) {
  const handler = getGameHandler(gameId);

  if (!handler) {
    return { error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  return handler.createSession(players);
}

/**
 * @param {unknown} gameId
 * @param {unknown} session
 * @param {string} playerId
 * @param {{ cellIndex?: unknown, type?: unknown, cardIndex?: unknown, source?: unknown }} move
 */
export function applyGameMove(gameId, session, playerId, move) {
  const handler = getGameHandler(gameId);

  if (!handler) {
    return { error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  const applyMove = /** @type {(session: unknown, playerId: string, move: { cellIndex?: unknown, type?: unknown, cardIndex?: unknown, source?: unknown }) => { session?: unknown, error?: string }} */ (handler.applyMove);
  return applyMove(session, playerId, move);
}

