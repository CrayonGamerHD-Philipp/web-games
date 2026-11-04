import type { GameDefinition } from '$lib/game-system/types';
import type { SchiffeMove, SchiffeSession } from './types';
import Game from './components/Game.svelte';

export const schiffeVersenkenGame: GameDefinition<SchiffeSession, SchiffeMove> = {
  id: 'schiffe-versenken',
  name: 'Schiffe versenken',
  description: 'Flotte verstecken, Koordinaten ansagen, Schiffe versenken – das Seeduell für zwei.',
  component: Game,
  icon: 'anchor',
  previewImage: '/images/schiffe-versenken-scene.svg',
  minPlayers: 2,
  maxPlayers: 2,
  supportsStandalone: false
};
