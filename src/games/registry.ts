import type { GameDefinition } from '$lib/game-system/types';
import { nochMalSoGutGame } from './noch-mal-so-gut';
import { skyjoGame } from './skyjo';
import { ticTacToeGame } from './tic-tac-toe';

export const games: GameDefinition[] = [ticTacToeGame, skyjoGame, nochMalSoGutGame];

export function getGameDefinition(gameId: string | null | undefined): GameDefinition | null {
  return games.find((game) => game.id === gameId) ?? null;
}
