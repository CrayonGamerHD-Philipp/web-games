import type { GameDefinition } from '$lib/game-system/types';
import type { AufMove, AufSession } from './types';
import Game from './components/Game.svelte';

export const aufUndAbGame: GameDefinition<AufSession, AufMove> = {
  id: 'auf-und-ab',
  name: 'Auf & Ab',
  description: 'Spiel deinen Vorratsstapel leer – auf zwei Stapel von 1 bis 12 hoch und auf zwei von 12 bis 1 runter. Joker passen immer.',
  component: Game,
  icon: 'cards',
  previewImage: '/images/auf-und-ab-scene.webp',
  minPlayers: 2,
  maxPlayers: 6,
  supportsStandalone: false
};
