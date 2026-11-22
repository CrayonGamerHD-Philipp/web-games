import type { GameDefinition } from '$lib/game-system/types';
import type { LtMove, LtSession } from './types';
import Game from './components/Game.svelte';

export const leuchtturmGame: GameDefinition<LtSession, LtMove> = {
  id: 'leuchtturm',
  name: 'Leuchtturmwächter',
  description: 'Alle gegen den Sturm: Haltet die Leuchtfeuer am Brennen, stopft die Deiche und lotst gemeinsam genug Schiffe in den Hafen.',
  component: Game,
  icon: 'map',
  previewImage: '/images/leuchtturm-scene.svg',
  minPlayers: 2,
  maxPlayers: 5,
  supportsStandalone: false
};
