import type { GameDefinition } from '$lib/game-system/types';
import type { TicTacToeMove, TicTacToeSession } from './types';
import Game from './components/Game.svelte';

export const ticTacToeGame: GameDefinition<TicTacToeSession, TicTacToeMove> = {
  id: 'tic-tac-toe',
  name: 'Tic Tac Toe',
  description: 'Klassisches Drei-gewinnt fuer zwei Spieler.',
  component: Game,
  icon: 'grid-3x3',
  previewImage: '/images/tic-tac-toe-scene.png',
  minPlayers: 2,
  maxPlayers: 2,
  supportsStandalone: false
};
