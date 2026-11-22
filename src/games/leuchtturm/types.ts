export type LtTileState = 'dry' | 'wet' | 'sunk';
export type LtLaneId = 'W' | 'O' | 'S';
export type LtRoleId = 'funzel' | 'lotti' | 'sacki' | 'kiek' | 'piepser';
export type LtActionType = 'walk' | 'sandbag' | 'kindle' | 'pilot';

export interface LtShip {
  id: number;
  lane: LtLaneId;
  step: number;
  drift: number;
}

export interface LtGuard {
  id: string;
  playerId: string;
  role: LtRoleId;
  at: string;
}

export interface LtBoardView {
  tiles: Record<string, LtTileState>;
  lamps: Record<LtLaneId, number>;
  ships: LtShip[];
  guards: LtGuard[];
  saved: number;
  wrecked: number;
  stormStep: number;
}

export interface LtTarget {
  at: string;
  action: LtActionType;
  shipId?: number;
  lamp?: LtLaneId;
}

export interface LtStormFrame {
  kind: 'flood' | 'flicker' | 'ship' | 'surge' | 'ships';
  title: string;
  text: string;
  view: LtBoardView;
}

export interface LtStormRecord {
  seq: number;
  playerId: string;
  /** Der Zug endete von selbst, weil keine Aktion mehr möglich war. */
  auto: boolean;
  before: LtBoardView;
  frames: LtStormFrame[];
  summary: string;
}

export interface LtEvent {
  seq: number;
  type: string;
  playerId: string | null;
  text: string;
}

export interface LtPlayer {
  id: string;
  name: string;
  stats: { steps: number; sandbags: number; kindled: number; piloted: number };
}

export interface LtState extends LtBoardView {
  phase: 'actions' | 'finished';
  difficulty: string;
  target: number;
  currentPlayerId: string | null;
  /** Der Wächter, der gerade zieht (allein spielt man zwei abwechselnd). */
  currentGuardId: string | null;
  turnOrder: string[];
  guardOrder: string[];
  solo: boolean;
  turn: number;
  actionsLeft: number;
  freeSandbagUsed: boolean;
  deckCount?: number;
  undoCount?: number;
  plans: Record<string, string>;
  storm: LtStormRecord | null;
  result: 'won' | 'lost' | null;
  reason: string;
  coop: true;
  winnerId: null;
  winnerIds: string[];
  isDraw: false;
  moveCount: number;
  lastEvent: LtEvent | null;
}

export interface LtSession {
  id: string;
  gameId: string;
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: LtPlayer[];
  state: LtState;
}

export interface LtMove {
  type: LtActionType | 'undo' | 'end' | 'plan';
  at?: string | null;
  shipId?: number;
}
