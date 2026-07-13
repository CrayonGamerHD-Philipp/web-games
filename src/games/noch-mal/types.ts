export type NochMalColor = 'lime' | 'yellow' | 'blue' | 'pink' | 'peach';

export interface NochMalCell {
  id: string;
  row: number;
  column: number;
  color: NochMalColor;
  hasStar: boolean;
}

export interface NochMalPlayer {
  id: string;
  name: string;
}

export interface NochMalState {
  checkedCells: string[];
  usedJokers: number[];
  currentPlayerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  roundScores: { playerId: string; score: number }[];
}

export interface NochMalSession {
  id: string;
  gameId: 'noch-mal';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: NochMalPlayer[];
  state: NochMalState;
}

export type NochMalMove =
  | { type: 'toggle-cell'; cellId: string }
  | { type: 'toggle-joker'; jokerIndex: number }
  | { type: 'reset' };
