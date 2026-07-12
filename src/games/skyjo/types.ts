export interface SkyjoMove {
  type: 'reveal-start' | 'draw' | 'replace' | 'replace-from-discard' | 'discard-and-reveal';
  source?: 'deck' | 'discard';
  cardIndex?: number;
}

export interface SkyjoCard {
  id: string;
  value: number;
}

export interface SkyjoSlot {
  id: string;
  value: number | null;
  revealed: boolean;
  removed: boolean;
}

export interface SkyjoPlayer {
  id: string;
  name: string;
  grid: SkyjoSlot[];
  roundScore: number;
}

export interface SkyjoScoreEntry {
  playerId: string;
  score: number;
}

export interface SkyjoRoundHistoryEntry {
  round: number;
  scores: SkyjoScoreEntry[];
}

export interface SkyjoMatch {
  enabled: boolean;
  targetScore: number;
  round: number;
  totalScores: SkyjoScoreEntry[];
  lastRoundScores: SkyjoScoreEntry[];
  roundHistory: SkyjoRoundHistoryEntry[];
  matchFinished: boolean;
  winnerIds: string[];
}

export interface SkyjoState {
  phase: 'setup' | 'running' | 'final-turns' | 'finished';
  deck: SkyjoCard[];
  discardPile: SkyjoCard[];
  currentPlayerId: string | null;
  drawnCard: SkyjoCard | null;
  drawnFrom: 'deck' | 'discard' | null;
  winnerId: string | null;
  isDraw: boolean;
  finalTriggerPlayerId: string | null;
  remainingFinalPlayerIds: string[];
  roundScores: SkyjoScoreEntry[];
  match?: SkyjoMatch;
}

export interface SkyjoSession {
  id: string;
  gameId: 'skyjo';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: SkyjoPlayer[];
  state: SkyjoState;
}

