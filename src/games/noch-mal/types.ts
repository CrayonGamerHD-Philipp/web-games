export type NochMalColor = 'lime' | 'yellow' | 'blue' | 'pink' | 'peach';
export type NochMalColorFace = NochMalColor | 'joker';
export type NochMalNumberFace = number | 'joker';
export type NochMalSpecial = 'bomb' | 'heart' | 'stars' | 'row' | 'block';
export type NochMalRowBonus = 'bomb' | 'token' | 'heart';
export type NochMalMode = 'klassisch' | 'erweitert';
export type NochMalBoardSize = 'klein' | 'normal' | 'gross';

export interface NochMalCell {
  id: string;
  row: number;
  col: number;
  color: NochMalColor;
  blockId: number;
  star: boolean;
  gold: boolean;
}

export interface NochMalBlock {
  id: number;
  color: NochMalColor;
  cells: string[];
}

export interface NochMalBoard {
  seed: number;
  cols: number;
  rows: number;
  startCol: number;
  letters: string[];
  cells: NochMalCell[];
  blocks: NochMalBlock[];
  columnPoints: { top: number[]; bottom: number[] };
  rowBonus: NochMalRowBonus[];
}

export interface NochMalClaim {
  first: string[];
  normal: string[];
}

export interface NochMalClaims {
  columns: NochMalClaim[];
  rows: NochMalClaim[];
  colors: Record<NochMalColor, NochMalClaim>;
}

export interface NochMalScore {
  columns: number;
  rows: number;
  colors: number;
  hearts: number;
  jokers: number;
  tokens: number;
  stars: number;
  total: number;
}

export interface NochMalResolvedCombo {
  colorDieIndex: number;
  numberDieIndex: number;
  color: NochMalColor;
  number: number;
  jokerCost: number;
}

/** Farbe + Zahl und/oder Sonderwürfel. */
export interface NochMalResolvedChoice {
  combo: NochMalResolvedCombo | null;
  special: NochMalSpecial | null;
}

export interface NochMalPlayer {
  id: string;
  name: string;
  checkedCells: string[];
  lastCells: string[];
  usedJokers: number;
  hearts: number;
  specialTokens: number;
  bonusBombs: number;
  specialsUsed: number;
  columnHearts: Record<string, number>;
  lockedChoice: NochMalResolvedChoice | null;
  confirmed: boolean;
  skipped: boolean;
  score: NochMalScore;
}

export interface NochMalRoll {
  id: string;
  colorDice: NochMalColorFace[];
  numberDice: NochMalNumberFace[];
  specialDie: NochMalSpecial | null;
}

export interface NochMalAchievement {
  kind: 'column' | 'row' | 'color';
  index: number;
  color?: NochMalColor;
  playerIds: string[];
  first: boolean;
  points: number;
  bonus?: NochMalRowBonus;
}

export interface NochMalEvent {
  seq: number;
  type: 'start' | 'roll' | 'finish';
  round: number;
  achievements: NochMalAchievement[];
  text: string;
}

export interface NochMalState {
  mode: NochMalMode;
  boardSize: NochMalBoardSize;
  board: NochMalBoard;
  phase: 'selecting' | 'waiting' | 'finished';
  round: number;
  maxRounds: number;
  roll: NochMalRoll;
  confirmedPlayerIds: string[];
  activePlayerId: string | null;
  startPlayerId: string | null;
  activeChoice: NochMalResolvedChoice | null;
  activeSkipped: boolean;
  claims: NochMalClaims;
  winnerIds: string[];
  winnerId: string | null;
  isDraw: boolean;
  roundScores: { playerId: string; score: number; breakdown: NochMalScore }[];
  higherScoreWins: true;
  lastEvent: NochMalEvent | null;
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

export interface NochMalChoice {
  combo: { colorDieIndex: number; numberDieIndex: number; color?: NochMalColor; number?: number } | null;
  special: boolean;
}

export type NochMalMove =
  | { type: 'submit-turn'; choice: NochMalChoice; cellIds: string[]; specialCellIds?: string[]; bonusBombCells?: string[] }
  | { type: 'lock-choice'; choice: NochMalChoice }
  | { type: 'skip-turn' };
