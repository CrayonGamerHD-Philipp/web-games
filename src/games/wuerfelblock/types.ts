export type BlockCategory =
  | 'einser'
  | 'zweier'
  | 'dreier'
  | 'vierer'
  | 'fuenfer'
  | 'sechser'
  | 'dreierpasch'
  | 'viererpasch'
  | 'fullhouse'
  | 'kleinestrasse'
  | 'grossestrasse'
  | 'volltreffer'
  | 'chance';

export type BlockSheet = Partial<Record<BlockCategory, number | null>>;

export interface BlockPlayer {
  id: string;
  name: string;
  sheet: BlockSheet;
  total: number;
}

export type BlockEventType = 'start' | 'roll' | 'hold' | 'score' | 'strike' | 'finish';

export interface BlockEvent {
  seq: number;
  type: BlockEventType;
  playerId: string | null;
  text: string;
  category?: BlockCategory;
  points?: number;
}

export interface BlockState {
  currentPlayerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  turnOrder: string[];
  startPlayerId: string | null;
  /** Five dice, 1–6; 0 before the first roll of a turn. */
  dice: number[];
  held: boolean[];
  rollsUsed: number;
  /** Increments with every roll (for the roll animation). */
  rollSeq: number;
  round: number;
  turnCount: number;
  moveCount: number;
  lastEvent: BlockEvent | null;
}

export interface BlockSession {
  id: string;
  gameId: 'wuerfelblock';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: BlockPlayer[];
  state: BlockState;
}

export type BlockMove =
  | { type: 'roll'; held: boolean[] }
  | { type: 'hold'; held: boolean[]; roll: number }
  | { type: 'score'; category: BlockCategory };
