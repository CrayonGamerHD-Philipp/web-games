import type { GameDefinition } from '$lib/game-system/types';
import type { VierMove, VierSession } from './types';
import Game from './components/Game.svelte';

export const vierInEinerReiheGame: GameDefinition<VierSession, VierMove> = {
  id: 'vier-in-einer-reihe',
  name: 'Vier in einer Reihe',
  description: 'Scheiben fallen nach unten: Wer zuerst vier in einer Linie hat – waagerecht, senkrecht oder schräg – gewinnt.',
  component: Game,
  icon: 'grid-3x3',
  previewImage: '/images/vier-in-einer-reihe-scene.svg',
  minPlayers: 2,
  maxPlayers: 2,
  supportsStandalone: false
};
