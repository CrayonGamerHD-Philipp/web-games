export type MoosColor = 'blau' | 'gruen' | 'gelb' | 'rot';
export type MoosCardColor = MoosColor | 'bunt';

export interface MoosCard {
  id: string;
  number: number;
  color: MoosCardColor;
  spirals: number;
  crosses: number;
  /** 1 Punkt je Geist dieser Farbe in der Auslage. */
  bonus: MoosColor | null;
}

export interface HiddenCard {
  hidden: true;
}

export interface MoosSlot {
  face: MoosCard | null;
  /** Fremdes Moos ist während des Durchgangs verdeckt (`{ hidden: true }`). */
  moss: MoosCard | HiddenCard | null;
}

export interface MoosPlayer {
  id: string;
  name: string;
  layout: MoosSlot[];
  discarded: number;
}

export interface MoosScore {
  numbers: number;
  spirals: number;
  crosses: number;
  bonus: number;
  groupSize: number;
  groupColor: MoosColor | null;
  group: number;
  total: number;
}

export type MoosEventType = 'start' | 'take' | 'round' | 'durchgang-end' | 'durchgang-start' | 'continue' | 'win';

export interface MoosEvent {
  seq: number;
  type: MoosEventType;
  playerId: string | null;
  card?: MoosCard;
  slot?: number | null;
  result?: string;
  text: string;
}

export interface MoosState {
  phase: 'drafting' | 'scoring' | 'finished';
  durchgang: number;
  totalDurchgaenge: number;
  runde: number;
  deckCount: number;
  market: MoosCard[];
  currentPlayerId: string | null;
  turnOrder: string[];
  startPlayerId: string | null;
  roundStarterId: string | null;
  lastTakerId: string | null;
  picksThisRound: number;
  confirmedPlayerIds: string[];
  results: { durchgang: number; scores: { playerId: string; breakdown: MoosScore }[] }[];
  totals: { playerId: string; score: number }[];
  roundScores: { playerId: string; score: number }[];
  higherScoreWins: true;
  winnerId: string | null;
  winnerIds: string[];
  isDraw: boolean;
  moveCount: number;
  lastEvent: MoosEvent | null;
}

export interface MoosSession {
  id: string;
  gameId: 'moosgeister';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: MoosPlayer[];
  state: MoosState;
}

export type MoosMove =
  | { type: 'take'; cardId: string; slot?: number; flipOld?: boolean }
  | { type: 'continue' };
