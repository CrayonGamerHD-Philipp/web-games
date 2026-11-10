import type { GameDefinition } from '$lib/game-system/types';
import type { MoosMove, MoosSession } from './types';
import Game from './components/Game.svelte';

export const moosgeisterGame: GameDefinition<MoosSession, MoosMove> = {
  id: 'moosgeister',
  name: 'Moosgeister',
  description: 'Reihum Waldgeister aus der Mitte wählen, auf ihren Platz im 3×3-Wald setzen und klug mit Moos unterlegen – drei Durchgänge lang.',
  component: Game,
  icon: 'cards',
  previewImage: '/images/moosgeister-scene.webp',
  minPlayers: 2,
  maxPlayers: 5,
  supportsStandalone: false
};
