export type NochMalColor = 'lime' | 'yellow' | 'blue' | 'pink' | 'peach';
export type NochMalColorDie = NochMalColor | 'joker';
export type NochMalNumberDie = 1 | 2 | 3 | 4 | 5 | 'joker';
export type NochMalPhase = 'selecting-dice' | 'selecting-cells' | 'waiting' | 'finished';

export interface NochMalCell {
  id: string;
  row: number;
  column: number;
  color: NochMalColor;
  hasStar: boolean;
}

export interface NochMalScoreBreakdown {
  columnPoints: number;
  colorPoints: number;
  starPenalty: number;
  jokerPenalty: number;
  total: number;
}

export interface NochMalPlayer {
  id: string;
  name: string;
  checkedCells: string[];
  usedJokers: number;
  selectedColor: NochMalColor | null;
  selectedNumber: number | null;
  selectedColorDieIndex: number | null;
  selectedNumberDieIndex: number | null;
  pendingCells: string[];
  confirmed: boolean;
  skipped: boolean;
  score: NochMalScoreBreakdown;
}

export interface NochMalDiceRoll {
  id: string;
  colorDice: NochMalColorDie[];
  numberDice: NochMalNumberDie[];
}

export interface NochMalState {
  phase: NochMalPhase;
  round: number;
  roll: NochMalDiceRoll;
  confirmedPlayerIds: string[];
  activePlayerId: string | null;
  activeColorDieIndex: number | null;
  activeNumberDieIndex: number | null;
  colorBonusClaims: Record<NochMalColor, string[]>;
  winnerIds: string[];
  winnerId: string | null;
  isDraw: boolean;
  roundScores: { playerId: string; score: number; breakdown: NochMalScoreBreakdown }[];
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
  | { type: 'select-dice'; colorDieIndex: number; numberDieIndex: number; color?: NochMalColor; number?: number }
  | { type: 'select-dice-and-toggle-cell'; colorDieIndex: number; numberDieIndex: number; color?: NochMalColor; number?: number; cellId: string }
  | { type: 'toggle-cell'; cellId: string }
  | { type: 'confirm-turn' }
  | { type: 'clear-selection' }
  | { type: 'skip-turn' };



