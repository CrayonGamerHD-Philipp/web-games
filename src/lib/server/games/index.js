import { createSkyjoSession, makeSkyjoMove, skyjoGame } from './skyjo.js';
import { createTicTacToeSession, makeTicTacToeMove, ticTacToeGame } from './tic-tac-toe.js';

export const availableGames = [ticTacToeGame, skyjoGame];

/** @param {unknown} gameId */
export function getGame(gameId) {
  return availableGames.find((game) => game.id === gameId) ?? null;
}

/**
 * @param {unknown} gameId
 * @param {{ id: string, name: string }[]} players
 */
export function createGameSession(gameId, players) {
  if (gameId === ticTacToeGame.id) {
    return createTicTacToeSession(players);
  }

  if (gameId === skyjoGame.id) {
    return createSkyjoSession(players);
  }

  return { error: 'Dieses Spiel ist nicht verfuegbar.' };
}

/**
 * @param {unknown} gameId
 * @param {unknown} session
 * @param {string} playerId
 * @param {{ cellIndex?: unknown, type?: unknown, cardIndex?: unknown, source?: unknown }} move
 */
export function applyGameMove(gameId, session, playerId, move) {
  if (gameId === ticTacToeGame.id) {
    return makeTicTacToeMove(
      /** @type {Exclude<ReturnType<typeof createTicTacToeSession>, { error: string }>} */ (session),
      playerId,
      move.cellIndex
    );
  }

  if (gameId === skyjoGame.id) {
    return makeSkyjoMove(
      /** @type {Exclude<ReturnType<typeof createSkyjoSession>, { error: string }>} */ (session),
      playerId,
      move
    );
  }

  return { error: 'Dieses Spiel ist nicht verfuegbar.' };
}