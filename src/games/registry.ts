import type { GameDefinition } from '$lib/game-system/types';
import { kunterbuntGame } from './kunterbunt';
import { nochMalGame } from './noch-mal';
import { schiffeVersenkenGame } from './schiffe-versenken';
import { skyjoGame } from './skyjo';
import { ticTacToeGame } from './tic-tac-toe';

export const games: GameDefinition[] = [ticTacToeGame, skyjoGame, nochMalGame, kunterbuntGame, schiffeVersenkenGame];

export function getGameDefinition(gameId: string | null | undefined): GameDefinition | null {
  return games.find((game) => game.id === gameId) ?? null;
}

