import type { GameDefinition } from '$lib/game-system/types';
import type { BuntMove, BuntSession } from './types';
import Game from './components/Game.svelte';

export const kunterbuntGame: GameDefinition<BuntSession, BuntMove> = {
  id: 'kunterbunt',
  name: 'Kunterbunt',
  description: 'Farbe oder Zahl bedienen, +2 und +4 weiterreichen, Farben wünschen – und vor der letzten Karte „Bunt!“ rufen.',
  component: Game,
  icon: 'cards',
  previewImage: '/images/kunterbunt-scene.webp',
  minPlayers: 2,
  maxPlayers: 8,
  supportsStandalone: false
};
