import type { GameDefinition } from '$lib/game-system/types';
import { nochMalGame } from './noch-mal';
import { skyjoGame } from './skyjo';
import { ticTacToeGame } from './tic-tac-toe';

export const games: GameDefinition[] = [ticTacToeGame, skyjoGame, nochMalGame];

export function getGameDefinition(gameId: string | null | undefined): GameDefinition | null {
  return games.find((game) => game.id === gameId) ?? null;
}

