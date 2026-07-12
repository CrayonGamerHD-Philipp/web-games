import type { GameDefinition } from '$lib/game-system/types';
import { skyjoGame } from './skyjo';
import { ticTacToeGame } from './tic-tac-toe';

export const games: GameDefinition[] = [ticTacToeGame, skyjoGame];

export function getGameDefinition(gameId: string | null | undefined): GameDefinition | null {
  return games.find((game) => game.id === gameId) ?? null;
}

