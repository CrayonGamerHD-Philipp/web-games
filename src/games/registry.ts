import { sudokuDuellGame } from './sudoku-duell';
import { moosgeisterGame } from './moosgeister';
import { aufUndAbGame } from './auf-und-ab';
import { abNachHauseGame } from './ab-nach-hause';
import { vierInEinerReiheGame } from './vier-in-einer-reihe';
import { wuerfelblockGame } from './wuerfelblock';
import type { GameDefinition } from '$lib/game-system/types';
import { kunterbuntGame } from './kunterbunt';
import { nochMalGame } from './noch-mal';
import { schiffeVersenkenGame } from './schiffe-versenken';
import { skyjoGame } from './skyjo';
import { ticTacToeGame } from './tic-tac-toe';

export const games: GameDefinition[] = [ticTacToeGame, skyjoGame, nochMalGame, kunterbuntGame, schiffeVersenkenGame, vierInEinerReiheGame, wuerfelblockGame, abNachHauseGame, sudokuDuellGame, moosgeisterGame, aufUndAbGame];

export function getGameDefinition(gameId: string | null | undefined): GameDefinition | null {
  return games.find((game) => game.id === gameId) ?? null;
}

