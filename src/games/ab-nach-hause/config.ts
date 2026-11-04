import type { GameDefinition } from '$lib/game-system/types';
import type { HeimMove, HeimSession } from './types';
import Game from './components/Game.svelte';

export const abNachHauseGame: GameDefinition<HeimSession, HeimMove> = {
  id: 'ab-nach-hause',
  name: 'Ab nach Hause',
  description: 'Würfeln, rauskommen, schlagen: Wer bringt zuerst alle vier Figuren ins Ziel?',
  component: Game,
  icon: 'dice',
  previewImage: '/images/ab-nach-hause-scene.webp',
  minPlayers: 2,
  maxPlayers: 4,
  supportsStandalone: false
};
