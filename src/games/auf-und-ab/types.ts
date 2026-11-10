export interface AufCard {
  id: string;
  /** `null` = Joker. */
  value: number | null;
}

export interface AufPileEntry {
  card: AufCard;
  /** Gezählter Wert (bei Jokern die Zahl, für die er steht). */
  value: number;
}

export interface AufBuildPile {
  id: 'up1' | 'up2' | 'down1' | 'down2';
  dir: 'up' | 'down';
  cards: AufPileEntry[];
}

export interface AufPlayerStats {
  played: number;
  fromStock: number;
  jokers: number;
  completed: number;
}

export interface AufPlayer {
  id: string;
  name: string;
  /** Nur die eigene Hand wird geschickt, sonst leer. */
  hand: AufCard[];
  handCount: number;
  /** Clients bekommen nur die oberste Karte. */
  stock: AufCard[];
  stockCount: number;
  discards: AufCard[][];
  stats: AufPlayerStats;
}

export type AufEventType = 'start' | 'play' | 'complete' | 'refill' | 'discard' | 'end-turn' | 'win';

export interface AufEvent {
  seq: number;
  type: AufEventType;
  playerId: string | null;
  card?: AufCard;
  value?: number;
  pileId?: string;
  source?: string;
  text: string;
}

export interface AufState {
  currentPlayerId: string | null;
  turnOrder: string[];
  startPlayerId: string | null;
  stockSize: number;
  deckCount: number;
  buildPiles: AufBuildPile[];
  completedPiles: number;
  reshuffles: number;
  idleTurns: number;
  builtThisTurn: boolean;
  turnNumber: number;
  winnerId: string | null;
  winnerIds: string[];
  isDraw: boolean;
  moveCount: number;
  lastEvent: AufEvent | null;
}

export interface AufSession {
  id: string;
  gameId: 'auf-und-ab';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: AufPlayer[];
  state: AufState;
}

export type AufSource = 'hand' | 'stock' | 'discard';

export type AufMove =
  | { type: 'play'; source: AufSource; cardId?: string; discardIndex?: number; pileId: string }
  | { type: 'discard'; cardId: string; discardIndex: number }
  | { type: 'end-turn' };
