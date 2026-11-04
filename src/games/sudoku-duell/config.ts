import type { GameDefinition } from '$lib/game-system/types';
import type { SudokuMove, SudokuSession } from './types';
import Game from './components/Game.svelte';

export const sudokuDuellGame: GameDefinition<SudokuSession, SudokuMove> = {
  id: 'sudoku-duell',
  name: 'Sudoku-Duell',
  description: 'Alle lösen gleichzeitig dasselbe Sudoku. Falsche Zahlen sperren dich kurz – wer zuerst fertig ist, gewinnt.',
  component: Game,
  icon: 'grid-3x3',
  previewImage: '/images/sudoku-duell-scene.svg',
  minPlayers: 2,
  maxPlayers: 8,
  supportsStandalone: false
};
