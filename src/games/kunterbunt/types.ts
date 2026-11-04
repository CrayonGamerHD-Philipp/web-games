export type BuntColor = 'kirsche' | 'sonne' | 'wiese' | 'meer';
export type BuntValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'plus2'
  | 'skip'
  | 'reverse'
  | 'wild'
  | 'wild4';

export interface BuntCard {
  id: string;
  /** `null` for Farbwunsch / Farbwunsch +4. */
  color: BuntColor | null;
  value: BuntValue;
  /** Set on a played wish card; reset when the card is reshuffled into the deck. */
  wishColor?: BuntColor | null;
}

export interface BuntPlayer {
  id: string;
  name: string;
  /** Only the viewer's own hand is sent; everyone else gets an empty array. */
  hand: BuntCard[];
  handCount: number;
}

export type BuntEventType =
  | 'start'
  | 'play'
  | 'wish'
  | 'skip'
  | 'reverse'
  | 'stack'
  | 'draw'
  | 'draw-pending'
  | 'pass'
  | 'no-cards'
  | 'bunt'
  | 'bunt-penalty'
  | 'win';

export interface BuntEvent {
  seq: number;
  type: BuntEventType;
  playerId: string | null;
  card?: BuntCard;
  text: string;
  reshuffled?: boolean;
  /** Number of penalty cards drawn for a forgotten „Bunt!“. */
  penalty?: number;
}

export interface BuntState {
  currentPlayerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  /** Server only; replaced by `deckCount` for clients. */
  deck?: BuntCard[];
  deckCount: number;
  /** Clients receive only the last few cards; `discardCount` is the full size. */
  discardPile: BuntCard[];
  discardCount: number;
  /** Cards the current player must draw unless they stack. */
  pendingDraw: number;
  wishColor: BuntColor | null;
  direction: 1 | -1;
  hasDrawn: boolean;
  drawnCardId: string | null;
  turnOrder: string[];
  startPlayerId: string | null;
  moveCount: number;
  lastEvent: BuntEvent | null;
}

export interface BuntSession {
  id: string;
  gameId: 'kunterbunt';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: BuntPlayer[];
  state: BuntState;
}

export type BuntMove =
  | { type: 'play'; cardId: string; wishColor?: BuntColor; bunt?: boolean }
  | { type: 'draw' }
  | { type: 'pass' };
