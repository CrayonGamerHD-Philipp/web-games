import type { Component } from 'svelte';

export type GameStatus = 'idle' | 'running' | 'paused' | 'finished' | 'error';

export type GameResultStatus = 'won' | 'lost' | 'draw' | 'cancelled';

export interface GamePlayer {
  id: string;
  name: string;
  score?: number;
  isHost?: boolean;
}

export interface GameResult {
  status: GameResultStatus;
  winnerId?: string;
  winnerName?: string;
  title?: string;
  message?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface GameController {
  start(): void;
  restart(): void;
  pause?(): void;
  resume?(): void;
  destroy?(): void;
}

export interface GameComponentProps<
  TGame = unknown,
  TMove extends object = Record<string, unknown>,
  TSettings extends object = Record<string, unknown>
> {
  game: TGame | null;
  players?: GamePlayer[];
  currentPlayerId?: string;
  settings?: TSettings;
  isLoading?: boolean;
  renderNonce?: number;
  onMove?: (move: TMove) => void;
  onGameFinished?: (result: GameResult) => void;
  onGameStateChanged?: (status: GameStatus) => void;
}

export interface GameDefinition<
  TGame = unknown,
  TMove extends object = Record<string, unknown>,
  TSettings extends object = Record<string, unknown>
> {
  id: string;
  name: string;
  description?: string;
  component: Component;
  icon?: string;
  previewImage?: string;
  minPlayers?: number;
  maxPlayers?: number;
  settings?: TSettings;
  supportsPause?: boolean;
  supportsStandalone?: boolean;
}
