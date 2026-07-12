import type { GameDefinition } from '$lib/game-system/types';
import type { SkyjoMove, SkyjoSession } from './types';
import Game from './components/Game.svelte';

export const skyjoGame: GameDefinition<SkyjoSession, SkyjoMove> = {
  id: 'skyjo',
  name: 'Skyjo',
  description: 'Kartenspielrunde mit niedrigen Punkten, Ablage und finalen Zuegen.',
  component: Game,
  icon: 'cards',
  previewImage: '/images/skyjo-scene.png',
  minPlayers: 2,
  maxPlayers: 8,
  supportsStandalone: false
};
