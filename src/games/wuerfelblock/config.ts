import type { GameDefinition } from '$lib/game-system/types';
import type { BlockMove, BlockSession } from './types';
import Game from './components/Game.svelte';

export const wuerfelblockGame: GameDefinition<BlockSession, BlockMove> = {
  id: 'wuerfelblock',
  name: 'Würfelblock',
  description: 'Fünf Würfel, drei Würfe, dreizehn Zeilen: Pasch, Straße oder Volltreffer – wer füllt den Block am besten?',
  component: Game,
  icon: 'dice',
  previewImage: '/images/wuerfelblock-scene.webp',
  minPlayers: 1,
  maxPlayers: 6,
  supportsStandalone: false
};
