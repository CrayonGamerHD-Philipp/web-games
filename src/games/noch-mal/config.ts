import type { GameDefinition } from '$lib/game-system/types';
import type { NochMalMove, NochMalSession } from './types';
import Game from './components/Game.svelte';

export const nochMalGame: GameDefinition<NochMalSession, NochMalMove> = {
  id: 'noch-mal',
  name: 'Verrückte Kreuze',
  description: 'Farbe und Zahl würfeln, Blöcke ankreuzen, Spalten und Zeilen füllen – jede Runde auf einem neuen Spielfeld. Mit Sonderwürfel, Bomben und Herzen.',
  component: Game,
  icon: 'dice',
  previewImage: '/images/noch-mal-scene.webp',
  minPlayers: 1,
  maxPlayers: 6,
  supportsStandalone: false
};