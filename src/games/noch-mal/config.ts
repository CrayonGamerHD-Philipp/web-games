import type { GameDefinition } from '$lib/game-system/types';
import type { NochMalMove, NochMalSession } from './types';
import Game from './components/Game.svelte';

export const nochMalGame: GameDefinition<NochMalSession, NochMalMove> = {
  id: 'noch-mal',
  name: 'Noch mal',
  description: 'Ein simples digitales Spielblatt zum Markieren von Feldern, Jokern und Punkten.',
  component: Game,
  icon: 'grid-3x3',
  minPlayers: 1,
  maxPlayers: 6,
  supportsStandalone: true
};
