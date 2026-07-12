export type CellColor = 'yellow' | 'green' | 'blue' | 'red' | 'purple';
export type CellPattern = 'sun' | 'leaf' | 'wave' | 'bolt' | 'gem';
export type DieId = string;
export type GamePhase = 'setup' | 'rolling' | 'selectingDice' | 'selectingCells' | 'confirmingMove' | 'passivePlayers' | 'scoring' | 'finished';
export type SpecialAction = 'none' | 'colorBonus' | 'numberBonus' | 'extraSelection' | 'rowBonus' | 'columnBonus';
export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface BoardCellDefinition {
  row: number;
  column: number;
  color: CellColor;
  hasStar: boolean;
}

export interface BoardCell extends BoardCellDefinition {
  id: string;
  marked: boolean;
  markedBy?: string;
}

export interface BoardLayout {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: BoardCellDefinition[][];
  columnLabels: string[];
  rowLabels: string[];
  columnScoresFirst: number[];
  columnScoresLater: number[];
  rowScores: number[];
  colorScoresFirst: Record<CellColor, number>;
  colorScoresLater: Record<CellColor, number>;
  startColumn: number;
}

export interface NumberDieResult {
  id: DieId;
  type: 'number';
  value: number | 'joker';
  reservedBy?: string;
}

export interface ColorDieResult {
  id: DieId;
  type: 'color';
  value: CellColor | 'joker';
  reservedBy?: string;
}

export interface SpecialDieResult {
  id: DieId;
  type: 'special';
  value: SpecialAction;
  usedBy?: string;
}

export interface DiceRoll {
  id: string;
  seed: number;
  numberDice: NumberDieResult[];
  colorDice: ColorDieResult[];
  specialDie: SpecialDieResult;
}

export interface SelectedDice {
  colorDieId: DieId;
  numberDieId: DieId;
  color: CellColor;
  count: number;
  usesColorJoker: boolean;
  usesNumberJoker: boolean;
  specialAction: SpecialAction;
}

export interface PendingMove {
  playerId: string;
  selectedDice: SelectedDice;
  cellIds: string[];
  reason?: string;
}

export interface ScoreBreakdown {
  columnPoints: number;
  rowPoints: number;
  colorPoints: number;
  bonusPoints: number;
  starPenalty: number;
  jokerPenalty: number;
  total: number;
  completedColumns: number[];
  completedRows: number[];
  completedColors: CellColor[];
}

export interface NochMalPlayer {
  id: string;
  name: string;
  isAi?: boolean;
  aiDifficulty?: AiDifficulty;
  board: BoardCell[][];
  usedJokers: number;
  bonusPoints: number;
  score: ScoreBreakdown;
  completedColumns: number[];
  completedRows: number[];
  completedColors: CellColor[];
  skippedTurns: number;
}

export interface NochMalSettings {
  playerCount: number;
  playerNames: string[];
  layoutId: string;
  animations: boolean;
  sound: boolean;
  hints: boolean;
  confirmBeforeCommit: boolean;
  colorSymbols: boolean;
  aiDifficulty: AiDifficulty;
  aiPlayers: number;
  allowUndoLastMove: boolean;
  soloRounds: number;
}

export interface GameHistoryEntry {
  id: string;
  round: number;
  activePlayerId: string;
  playerId: string;
  rollId: string;
  selectedDice: SelectedDice | null;
  cellIds: string[];
  skipped: boolean;
  createdAt: string;
}

export interface AreaClaim {
  index: number;
  playerIds: string[];
  first: boolean;
}

export interface NochMalGameState {
  phase: GamePhase;
  round: number;
  activePlayerIndex: number;
  actingPlayerIndex: number;
  players: NochMalPlayer[];
  currentRoll: DiceRoll | null;
  selectedDice: SelectedDice | null;
  pendingMove: PendingMove | null;
  history: GameHistoryEntry[];
  settings: NochMalSettings;
  layout: BoardLayout;
  claimedColumns: AreaClaim[];
  claimedColors: { color: CellColor; playerIds: string[]; first: boolean }[];
  finishedAt?: string;
  winnerIds: string[];
  rankings: { playerId: string; name: string; score: number; rank: number }[];
}

export interface NochMalSaveData {
  version: number;
  gameState: NochMalGameState;
}

export interface MoveValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ValidMove {
  cellIds: string[];
  scoreEstimate: number;
}


