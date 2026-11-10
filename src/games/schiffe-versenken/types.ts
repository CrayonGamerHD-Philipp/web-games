export type SchiffeShipDir = 'h' | 'v';

export interface SchiffeFleetEntry {
  id: string;
  name: string;
  length: number;
}

export interface SchiffeShip {
  id: string;
  name: string;
  length: number;
  x: number;
  y: number;
  dir: SchiffeShipDir;
  hits: number;
  sunk: boolean;
}

export interface SchiffeShot {
  x: number;
  y: number;
  result: 'hit' | 'miss';
}

export interface SchiffePlayer {
  id: string;
  name: string;
  ready: boolean;
  placed: boolean;
  /** Own ships for the viewer; for everyone else only the sunk ones (redacted). */
  ships: SchiffeShip[];
  /** Shots fired at this player's board. */
  incoming: SchiffeShot[];
  sunkCount: number;
}

export interface SchiffeLastShot {
  seq: number;
  shooterId: string;
  targetId: string;
  x: number;
  y: number;
  result: 'hit' | 'miss' | 'sunk';
  shipName: string | null;
}

export interface SchiffeState {
  phase: 'placement' | 'battle' | 'finished';
  size: number;
  fleet: SchiffeFleetEntry[];
  currentPlayerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  lastShot: SchiffeLastShot | null;
  shotCount: number;
  extraShotOnHit?: boolean;
  /** Karte: offenes Meer oder mit Inseln. */
  map?: 'meer' | 'inseln' | 'archipel';
  /** Land (für beide Spieler gleich): dort liegen keine Schiffe, dorthin wird nicht geschossen. */
  terrain?: SchiffeTerrain[];
}

export interface SchiffeTerrain {
  x: number;
  y: number;
  kind: 'island' | 'rock';
}

export interface SchiffeSession {
  id: string;
  gameId: 'schiffe-versenken';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: SchiffePlayer[];
  state: SchiffeState;
}

export interface SchiffePlacement {
  x: number;
  y: number;
  length: number;
  dir: SchiffeShipDir;
}

export type SchiffeMove =
  | { type: 'place-fleet'; ships: SchiffePlacement[] }
  | { type: 'random-fleet' }
  | { type: 'ready' }
  | { type: 'shoot'; x: number; y: number };
