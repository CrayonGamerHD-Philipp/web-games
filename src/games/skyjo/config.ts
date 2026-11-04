import type { GameDefinition } from '$lib/game-system/types';
import type { SkyjoMove, SkyjoSession } from './types';
import Game from './components/Game.svelte';

export const skyjoGame: GameDefinition<SkyjoSession, SkyjoMove> = {
  id: 'skyjo',
  name: 'Skyjo',
  description: 'Kartenspiel: Sammle möglichst wenige Punkte, tausche und decke Karten auf.',
  component: Game,
  icon: 'cards',
  previewImage: '/images/skyjo-scene.png',
  minPlayers: 2,
  maxPlayers: 8,
  supportsStandalone: false
};
