import type { GameDefinition } from '$lib/game-system/types';
import Game from './Game.svelte';
import type { NochMalGameState } from './types.ts';

export const nochMalSoGutGame: GameDefinition<NochMalGameState> = {
  id: 'noch-mal-so-gut',
  name: 'Noch mal so gut',
  description: 'Eigenstaendiges Roll-and-Write mit Farbgruppen, Jokern, Spezialwuerfel und Wertungsleisten.',
  component: Game,
  icon: 'dice-5',
  minPlayers: 1,
  maxPlayers: 6,
  supportsStandalone: true,
  settings: {
    category: 'Wuerfel- und Strategiespiel',
    duration: '20 bis 30 Minuten',
    modes: ['Einzelspieler', 'Lokaler Mehrspieler', 'Computergegner']
  }
};


