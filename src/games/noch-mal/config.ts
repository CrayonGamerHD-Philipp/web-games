import type { GameDefinition } from '$lib/game-system/types';
import type { NochMalMove, NochMalSession } from './types';
import Game from './components/Game.svelte';

export const nochMalGame: GameDefinition<NochMalSession, NochMalMove> = {
  id: 'noch-mal',
  name: 'Noch mal',
  description: 'Wuerfelspiel mit privaten Spielblaettern, gemeinsamen Wuerfeln und gleichzeitigen Zuegen.',
  component: Game,
  icon: 'dice',
  previewImage: '/images/party-hero.png',
  minPlayers: 1,
  maxPlayers: 6,
  supportsStandalone: false
};