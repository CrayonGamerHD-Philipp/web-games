import { createKunterbuntSession, kunterbuntGame, makeKunterbuntMove, redactKunterbuntSession } from '../../../games/kunterbunt/server.js';
import { createNochMalSession, makeNochMalMove, nochMalGame } from '../../../games/noch-mal/server.js';
import { createSchiffeVersenkenSession, makeSchiffeVersenkenMove, redactSchiffeVersenkenSession, schiffeVersenkenGame } from '../../../games/schiffe-versenken/server.js';
import { createSkyjoSession, makeSkyjoMove, skyjoGame } from '../../../games/skyjo/server.js';
import { createTicTacToeSession, makeTicTacToeMove, ticTacToeGame } from '../../../games/tic-tac-toe/server.js';

const gameHandlers = [
  {
    definition: schiffeVersenkenGame,
    createSession: createSchiffeVersenkenSession,
    /**
     * @param {unknown} session
     * @param {string} playerId
     * @param {any} move
     */
    applyMove: (session, playerId, move) =>
      makeSchiffeVersenkenMove(/** @type {Exclude<ReturnType<typeof createSchiffeVersenkenSession>, { error: string }>} */ (session), playerId, move),
    /**
     * @param {unknown} session
     * @param {string | null} viewerId
     */
    redact: (session, viewerId) =>
      redactSchiffeVersenkenSession(/** @type {Exclude<ReturnType<typeof createSchiffeVersenkenSession>, { error: string }>} */ (session), viewerId)
  },
  {
    definition: kunterbuntGame,
    createSession: createKunterbuntSession,
    /**
     * @param {unknown} session
     * @param {string} playerId
     * @param {any} move
     */
    applyMove: (session, playerId, move) =>
      makeKunterbuntMove(/** @type {Exclude<ReturnType<typeof createKunterbuntSession>, { error: string }>} */ (session), playerId, move),
    /**
     * @param {unknown} session
     * @param {string | null} viewerId
     */
    redact: (session, viewerId) =>
      redactKunterbuntSession(/** @type {Exclude<ReturnType<typeof createKunterbuntSession>, { error: string }>} */ (session), viewerId)
  },
  {
    definition: nochMalGame,
    createSession: createNochMalSession,
    /**
     * @param {unknown} session
     * @param {string} playerId
     * @param {{ type?: unknown, cellId?: unknown, colorDieIndex?: unknown, numberDieIndex?: unknown, color?: unknown, number?: unknown }} move
     */
    applyMove: (session, playerId, move) =>
      makeNochMalMove(
        /** @type {Exclude<ReturnType<typeof createNochMalSession>, { error: string }>} */ (session),
        playerId,
        move
      )
  },
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
 * @param {Record<string, unknown>} [options]
 */
export function createGameSession(gameId, players, options = {}) {
  const handler = getGameHandler(gameId);

  if (!handler) {
    return { error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  return handler.createSession(players, options);
}

/**
 * @param {unknown} gameId
 * @param {unknown} session
 * @param {string} playerId
 * @param {{ cellIndex?: unknown, type?: unknown, cardIndex?: unknown, source?: unknown, cellId?: unknown, colorDieIndex?: unknown, numberDieIndex?: unknown, color?: unknown, number?: unknown }} move
 */
export function applyGameMove(gameId, session, playerId, move) {
  const handler = getGameHandler(gameId);

  if (!handler) {
    return { error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  const applyMove = /** @type {(session: unknown, playerId: string, move: { cellIndex?: unknown, type?: unknown, cardIndex?: unknown, source?: unknown, cellId?: unknown, colorDieIndex?: unknown, numberDieIndex?: unknown, color?: unknown, number?: unknown }) => { session?: unknown, error?: string }} */ (handler.applyMove);
  return applyMove(session, playerId, move);
}

/**
 * Removes information the viewer must not see (other players' hands, ship positions, …).
 * Games opt in by providing `redact(session, viewerId)` on their handler; the session is
 * already a deep clone, so handlers may mutate it.
 * @param {unknown} gameId
 * @param {unknown} session
 * @param {string | null} viewerId
 */
export function redactGameSession(gameId, session, viewerId) {
  const handler = /** @type {{ redact?: (session: unknown, viewerId: string | null) => unknown } | null} */ (getGameHandler(gameId));
  return handler?.redact ? handler.redact(session, viewerId) : session;
}
