export type VierSeat = 0 | 1;

export interface VierPlayer {
  id: string;
  name: string;
  seat: VierSeat;
}

export interface VierLastMove {
  index: number;
  column: number;
  row: number;
  playerId: string;
  seat: VierSeat;
}

export type VierEventType = 'start' | 'drop' | 'win' | 'draw';

export interface VierEvent {
  seq: number;
  type: VierEventType;
  playerId: string | null;
  text: string;
  column?: number;
  row?: number;
}

export interface VierState {
  /** 42 Felder, Index = row * 7 + column, Reihe 0 oben. */
  board: (VierSeat | null)[];
  currentPlayerId: string | null;
  startPlayerId: string;
  winnerId: string | null;
  isDraw: boolean;
  winningLine: number[];
  lastMove: VierLastMove | null;
  moveCount: number;
  lastEvent: VierEvent;
}

export interface VierSession {
  id: string;
  gameId: 'vier-in-einer-reihe';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: VierPlayer[];
  state: VierState;
}

export interface VierMove {
  type: 'drop';
  column: number;
}
