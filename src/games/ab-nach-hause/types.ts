export interface HeimPlayer {
  id: string;
  name: string;
  /** 0 = links oben, 1 = rechts oben, 2 = rechts unten, 3 = links unten. */
  seat: number;
  /** Fortschritt je Figur: -1 Basis, 0–39 Bahn (ab eigenem Startfeld), 40–43 Zuhause. */
  pieces: number[];
  homeCount: number;
  /** Items auf der Hand (höchstens 2), nur mit Items-Einstellung. */
  items: HeimItem[];
  itemsUsed: number;
}

export type HeimItem = 'wish' | 'turbo' | 'reroll' | 'shield' | 'storm' | 'trap';

export interface HeimTrap {
  field: number;
  ownerId: string;
}

export interface HeimItemState {
  enabled: boolean;
  /** Glücksfelder (Bahnindex). */
  boxes: number[];
  traps: HeimTrap[];
  /** Spieler mit aktivem Schutzschild. */
  shields: string[];
  /** Turbo ist für den aktuellen Zug aktiv. */
  turbo: boolean;
}

export interface HeimCapture {
  playerId: string;
  pieceIndex: number;
}

export interface HeimLegalMove {
  pieceIndex: number;
  from: number;
  to: number;
  capture: HeimCapture | null;
}

export interface HeimLastMove extends HeimLegalMove {
  seq: number;
  playerId: string;
}

export type HeimEventType = 'start' | 'roll' | 'no-move' | 'retry' | 'bonus' | 'enter' | 'move' | 'capture' | 'home' | 'win' | 'item' | 'trap' | 'pickup';

export interface HeimEvent {
  seq: number;
  type: HeimEventType;
  playerId: string | null;
  text: string;
  dice?: number;
  capturedPlayerId?: string;
}

export interface HeimState {
  currentPlayerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  phase: 'roll' | 'move' | 'done';
  dice: number | null;
  rollSeq: number;
  /** Verbleibende Würfe in diesem (Teil-)Zug. */
  rollsLeft: number;
  /** 3 bei „drei Versuchen“, sonst 1. */
  maxRolls: number;
  legalMoves: HeimLegalMove[];
  turnOrder: string[];
  moveCount: number;
  lastMove: HeimLastMove | null;
  lastEvent: HeimEvent | null;
  items: HeimItemState;
}

export interface HeimSession {
  id: string;
  gameId: 'ab-nach-hause';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: HeimPlayer[];
  state: HeimState;
}

export type HeimMove = { type: 'roll' } | { type: 'move'; pieceIndex: number } | { type: 'use-item'; item: HeimItem; value?: number };
