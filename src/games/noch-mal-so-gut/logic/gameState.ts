import type {
  CellColor,
  DiceRoll,
  NochMalGameState,
  NochMalPlayer,
  NochMalSaveData,
  NochMalSettings,
  PendingMove,
  SelectedDice,
  SpecialAction
} from '../types.ts';
import { createPlayerBoard, getBoardLayout } from '../data/boardLayouts.ts';
import { defaultSettings, maxJokers, saveVersion } from '../data/gameConfig.ts';
import { availableColorDice, availableNumberDice, reserveDice, rollDice } from './dice.ts';
import { validateCellSelection } from './validation.ts';
import { calculateScore, rankPlayers, updateAreaClaims } from './scoring.ts';

function cloneState(state: NochMalGameState): NochMalGameState {
  return structuredClone(state);
}

function emptyScore() {
  return { columnPoints: 0, rowPoints: 0, colorPoints: 0, bonusPoints: 0, starPenalty: 0, jokerPenalty: 0, total: 0, completedColumns: [], completedRows: [], completedColors: [] };
}

export function normalizeSettings(settings: Partial<NochMalSettings> = {}): NochMalSettings {
  const playerCount = Math.max(1, Math.min(6, Number(settings.playerCount ?? defaultSettings.playerCount)));
  const aiPlayers = Math.max(0, Math.min(playerCount - 1, Number(settings.aiPlayers ?? defaultSettings.aiPlayers)));
  const names = Array.from({ length: playerCount }, (_, index) => settings.playerNames?.[index]?.trim() || `Spieler ${index + 1}`);
  return {
    playerCount,
    playerNames: names,
    layoutId: settings.layoutId ?? defaultSettings.layoutId,
    animations: settings.animations ?? defaultSettings.animations,
    sound: settings.sound ?? defaultSettings.sound,
    hints: settings.hints ?? defaultSettings.hints,
    confirmBeforeCommit: settings.confirmBeforeCommit ?? defaultSettings.confirmBeforeCommit,
    colorSymbols: settings.colorSymbols ?? defaultSettings.colorSymbols,
    aiDifficulty: settings.aiDifficulty ?? defaultSettings.aiDifficulty,
    aiPlayers,
    allowUndoLastMove: settings.allowUndoLastMove ?? defaultSettings.allowUndoLastMove,
    soloRounds: settings.soloRounds ?? defaultSettings.soloRounds
  };
}

export function createGame(settingsInput: Partial<NochMalSettings> = {}): NochMalGameState {
  const settings = normalizeSettings(settingsInput);
  const layout = getBoardLayout(settings.layoutId);
  const players: NochMalPlayer[] = Array.from({ length: settings.playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    name: settings.playerNames[index] ?? `Spieler ${index + 1}`,
    isAi: index >= settings.playerCount - settings.aiPlayers,
    aiDifficulty: index >= settings.playerCount - settings.aiPlayers ? settings.aiDifficulty : undefined,
    board: createPlayerBoard(layout),
    usedJokers: 0,
    bonusPoints: 0,
    score: emptyScore(),
    completedColumns: [],
    completedRows: [],
    completedColors: [],
    skippedTurns: 0
  }));

  return {
    phase: 'rolling',
    round: 1,
    activePlayerIndex: 0,
    actingPlayerIndex: 0,
    players,
    currentRoll: null,
    selectedDice: null,
    pendingMove: null,
    history: [],
    settings,
    layout,
    claimedColumns: [],
    claimedColors: [],
    winnerIds: [],
    rankings: []
  };
}

export function rollCurrentDice(state: NochMalGameState, seed?: number): NochMalGameState {
  if (state.phase === 'finished') return state;
  const next = cloneState(state);
  next.currentRoll = rollDice(seed, { solo: next.players.length === 1 });
  next.selectedDice = null;
  next.pendingMove = null;
  next.actingPlayerIndex = next.activePlayerIndex;
  next.phase = 'selectingDice';
  return next;
}

export function canUseUnrestrictedDice(state: NochMalGameState): boolean {
  return state.round <= 3 || state.actingPlayerIndex === state.activePlayerIndex;
}

export function selectDice(
  state: NochMalGameState,
  colorDieId: string,
  numberDieId: string,
  options: { colorChoice?: CellColor; numberChoice?: number } = {}
): NochMalGameState {
  if (!state.currentRoll || state.phase === 'finished') return state;
  const player = state.players[state.actingPlayerIndex];
  const unrestricted = canUseUnrestrictedDice(state);
  const colorDie = availableColorDice(state.currentRoll, player.id, unrestricted).find((die) => die.id === colorDieId);
  const numberDie = availableNumberDice(state.currentRoll, player.id, unrestricted).find((die) => die.id === numberDieId);
  if (!colorDie || !numberDie) return state;

  const usesColorJoker = colorDie.value === 'joker';
  const usesNumberJoker = numberDie.value === 'joker';
  const color = usesColorJoker ? options.colorChoice : colorDie.value === 'joker' ? undefined : colorDie.value;
  const number = usesNumberJoker ? options.numberChoice : numberDie.value === 'joker' ? undefined : numberDie.value;
  if (!color || typeof number !== 'number' || number < 1 || number > 5) return state;

  const specialAction = state.currentRoll.specialDie.value;
  const count = Math.min(5, specialAction === 'numberBonus' ? number + 1 : number);
  const selectedDice: SelectedDice = { colorDieId, numberDieId, color, count, usesColorJoker, usesNumberJoker, specialAction };
  return { ...cloneState(state), selectedDice, pendingMove: null, phase: 'selectingCells' };
}

export function selectCells(state: NochMalGameState, cellIds: string[]): NochMalGameState {
  if (!state.selectedDice || state.phase === 'finished') return state;
  const next = cloneState(state);
  const selectedDice = next.selectedDice;
  if (!selectedDice) return state;
  const player = next.players[next.actingPlayerIndex];
  const validation = validateCellSelection(player.board, cellIds, selectedDice, next.layout.startColumn, player.usedJokers);
  next.pendingMove = { playerId: player.id, selectedDice, cellIds: [...new Set(cellIds)], reason: validation.reason };
  next.phase = validation.valid ? 'confirmingMove' : 'selectingCells';
  return next;
}

export function clearPendingMove(state: NochMalGameState): NochMalGameState {
  return { ...cloneState(state), pendingMove: null, phase: state.selectedDice ? 'selectingCells' : 'selectingDice' };
}

function applyBonuses(player: NochMalPlayer, selectedDice: SelectedDice, completedRowsBefore: number, completedColumnsBefore: number): void {
  if (selectedDice.specialAction === 'colorBonus') player.bonusPoints += 2;
  if (selectedDice.specialAction === 'rowBonus' && player.score.completedRows.length > completedRowsBefore) player.bonusPoints += 3;
  if (selectedDice.specialAction === 'columnBonus' && player.score.completedColumns.length > completedColumnsBefore) player.bonusPoints += 3;
}

export function confirmMove(state: NochMalGameState): NochMalGameState {
  if (!state.pendingMove || !state.currentRoll || state.phase === 'finished') return state;
  const next = cloneState(state);
  const player = next.players[next.actingPlayerIndex];
  const pending = next.pendingMove;
  const currentRoll = next.currentRoll;
  if (!pending || !currentRoll) return state;
  const validation = validateCellSelection(player.board, pending.cellIds, pending.selectedDice, next.layout.startColumn, player.usedJokers);
  if (!validation.valid) {
    next.pendingMove = { ...pending, reason: validation.reason };
    next.phase = 'selectingCells';
    return next;
  }

  const rowsBefore = player.score.completedRows.length;
  const columnsBefore = player.score.completedColumns.length;
  for (const id of pending.cellIds) {
    const [rowText, columnText] = id.split(':');
    const row = Number(rowText);
    const column = Number(columnText);
    const cell = player.board[row]?.[column];
    if (cell) {
      cell.marked = true;
      cell.markedBy = player.id;
    }
  }
  player.usedJokers += (pending.selectedDice.usesColorJoker ? 1 : 0) + (pending.selectedDice.usesNumberJoker ? 1 : 0);
  player.score = calculateScore(player, next.layout, next);
  applyBonuses(player, pending.selectedDice, rowsBefore, columnsBefore);
  player.score = calculateScore(player, next.layout, next);

  next.history.push({
    id: crypto.randomUUID(),
    round: next.round,
    activePlayerId: next.players[next.activePlayerIndex].id,
    playerId: player.id,
    rollId: currentRoll.id,
    selectedDice: pending.selectedDice,
    cellIds: pending.cellIds,
    skipped: false,
    createdAt: new Date().toISOString()
  });

  next.currentRoll = reserveDice(currentRoll, player.id, pending.selectedDice.colorDieId, pending.selectedDice.numberDieId);
  next.selectedDice = null;
  next.pendingMove = null;
  const withClaims = updateAreaClaims(next, [player.id]);
  return advanceAfterAction(recalculateScores(withClaims));
}

export function skipMove(state: NochMalGameState): NochMalGameState {
  if (state.phase === 'finished') return state;
  const next = cloneState(state);
  const player = next.players[next.actingPlayerIndex];
  player.skippedTurns += 1;
  next.history.push({
    id: crypto.randomUUID(),
    round: next.round,
    activePlayerId: next.players[next.activePlayerIndex].id,
    playerId: player.id,
    rollId: next.currentRoll?.id ?? 'none',
    selectedDice: null,
    cellIds: [],
    skipped: true,
    createdAt: new Date().toISOString()
  });
  next.selectedDice = null;
  next.pendingMove = null;
  return advanceAfterAction(recalculateScores(next));
}

function recalculateScores(state: NochMalGameState): NochMalGameState {
  for (const player of state.players) {
    player.score = calculateScore(player, state.layout, state);
  }
  return state;
}

export function advanceAfterAction(state: NochMalGameState): NochMalGameState {
  const next = cloneState(state);
  if (checkGameEnd(next)) return finishGame(next);

  if (next.actingPlayerIndex === next.activePlayerIndex) {
    const passive = next.players.findIndex((_, index) => index !== next.activePlayerIndex);
    if (passive >= 0) {
      next.actingPlayerIndex = passive;
      next.phase = 'passivePlayers';
      return next;
    }
  } else {
    const followingPassive = next.players.findIndex((_, index) => index > next.actingPlayerIndex && index !== next.activePlayerIndex);
    if (followingPassive >= 0) {
      next.actingPlayerIndex = followingPassive;
      next.phase = 'passivePlayers';
      return next;
    }
  }

  next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
  next.actingPlayerIndex = next.activePlayerIndex;
  if (next.activePlayerIndex === 0) next.round += 1;
  next.currentRoll = null;
  next.phase = 'rolling';
  return checkGameEnd(next) ? finishGame(next) : next;
}

export function checkGameEnd(state: NochMalGameState): boolean {
  if (state.phase === 'finished') return true;
  if (state.players.length === 1 && state.round > state.settings.soloRounds) return true;
  return state.players.some((player) => player.completedColors.length >= 2 || player.score.completedColumns.length >= 7 || player.score.completedRows.length >= 4);
}

export function finishGame(state: NochMalGameState): NochMalGameState {
  if (state.phase === 'finished') return state;
  const next = recalculateScores(cloneState(state));
  const rankings = rankPlayers(next.players);
  const bestScore = rankings[0]?.score ?? 0;
  next.rankings = rankings;
  next.winnerIds = rankings.filter((ranking) => ranking.score === bestScore).map((ranking) => ranking.playerId);
  next.phase = 'finished';
  next.finishedAt = new Date().toISOString();
  return next;
}

export function restartGame(state: NochMalGameState): NochMalGameState {
  return createGame(state.settings);
}

export function serializeGame(state: NochMalGameState): NochMalSaveData {
  return { version: saveVersion, gameState: cloneState(state) };
}

export function loadGame(saveData: unknown): NochMalGameState {
  if (!saveData || typeof saveData !== 'object') throw new Error('Spielstand ist beschaedigt.');
  const typed = saveData as Partial<NochMalSaveData>;
  if (typed.version !== saveVersion) throw new Error('Diese Spielstand-Version wird nicht unterstuetzt.');
  if (!typed.gameState || !typed.gameState.layout?.id) throw new Error('Spielstand ist unvollstaendig.');
  getBoardLayout(typed.gameState.layout.id);
  return typed.gameState;
}

export function createSelectedDiceFromIds(state: NochMalGameState, colorDieId: string, numberDieId: string, colorChoice?: CellColor, numberChoice?: number): SelectedDice | null {
  const next = selectDice(state, colorDieId, numberDieId, { colorChoice, numberChoice });
  return next.selectedDice;
}







