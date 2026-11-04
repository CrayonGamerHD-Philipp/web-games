export type SudokuDifficulty = 'leicht' | 'mittel' | 'schwer';

export interface SudokuPlayer {
  id: string;
  name: string;
  /** 81 cells (0 = empty). Only the viewer's own entries are sent; others get an empty array. */
  entries: number[];
  filledCount: number;
  /** 0–1, share of the empty cells solved. */
  progress: number;
  mistakes: number;
  finished: boolean;
  gaveUp: boolean;
  /** Server timestamp (ms) until which this player can't place numbers. */
  blockedUntil: number | null;
  /** Cell of the last wrong guess; only sent to the player themselves. */
  lastMistakeCell: number | null;
}

export type SudokuEventType = 'start' | 'place' | 'mistake' | 'give-up' | 'win' | 'draw';

export interface SudokuEvent {
  seq: number;
  type: SudokuEventType;
  playerId: string | null;
  text: string;
  /** Only present for the acting player. */
  cell?: number;
  value?: number;
}

export interface SudokuState {
  /** Everyone plays at once, so this is always null. */
  currentPlayerId: null;
  winnerId: string | null;
  isDraw: boolean;
  difficulty: SudokuDifficulty;
  /** 81 cells, 0 = empty. */
  givens: number[];
  givenCount: number;
  emptyCount: number;
  /** Server only; never sent to clients. */
  solution?: number[];
  startedAt: number;
  finishedAt: Record<string, number>;
  gaveUpAt: Record<string, number>;
  blockMs: number;
  moveCount: number;
  /** Server clock at the time the view was sent (for cooldown countdowns). */
  serverNow?: number;
  lastEvent: SudokuEvent | null;
}

export interface SudokuSession {
  id: string;
  gameId: 'sudoku-duell';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: SudokuPlayer[];
  state: SudokuState;
}

export type SudokuMove = { type: 'place'; cell: number; value: number } | { type: 'give-up' };
