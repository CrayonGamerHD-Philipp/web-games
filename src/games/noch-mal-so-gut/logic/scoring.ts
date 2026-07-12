import type { BoardCell, BoardLayout, CellColor, NochMalGameState, NochMalPlayer, ScoreBreakdown } from '../types.ts';
import { allCells, colorList } from '../data/boardLayouts.ts';
import { maxJokers } from '../data/gameConfig.ts';

function isColumnComplete(board: BoardCell[][], column: number): boolean {
  return board.every((row) => row[column]?.marked);
}

function isRowComplete(board: BoardCell[][], row: number): boolean {
  return board[row]?.every((cell) => cell.marked) ?? false;
}

function isColorComplete(board: BoardCell[][], color: CellColor): boolean {
  return allCells(board).filter((cell) => cell.color === color).every((cell) => cell.marked);
}

export function calculateScore(player: NochMalPlayer, layout: BoardLayout, state?: NochMalGameState): ScoreBreakdown {
  const completedColumns = Array.from({ length: layout.columns }, (_, column) => column).filter((column) => isColumnComplete(player.board, column));
  const completedRows = Array.from({ length: layout.rows }, (_, row) => row).filter((row) => isRowComplete(player.board, row));
  const completedColors = colorList().filter((color) => isColorComplete(player.board, color));

  const columnPoints = completedColumns.reduce((sum, column) => {
    const claim = state?.claimedColumns.find((entry) => entry.index === column && entry.playerIds.includes(player.id));
    const first = claim?.first ?? player.completedColumns.includes(column);
    return sum + (first ? layout.columnScoresFirst[column] : layout.columnScoresLater[column]);
  }, 0);

  const rowPoints = completedRows.reduce((sum, row) => sum + layout.rowScores[row], 0);

  const colorPoints = completedColors.reduce((sum, color) => {
    const claim = state?.claimedColors.find((entry) => entry.color === color && entry.playerIds.includes(player.id));
    const first = claim?.first ?? player.completedColors.includes(color);
    return sum + (first ? layout.colorScoresFirst[color] : layout.colorScoresLater[color]);
  }, 0);

  const unmarkedStars = allCells(player.board).filter((cell) => cell.hasStar && !cell.marked).length;
  const jokerPenalty = Math.max(0, player.usedJokers - 2) * 2;
  const starPenalty = unmarkedStars * -2;
  const total = columnPoints + rowPoints + colorPoints + player.bonusPoints + starPenalty - jokerPenalty;

  return {
    columnPoints,
    rowPoints,
    colorPoints,
    bonusPoints: player.bonusPoints,
    starPenalty,
    jokerPenalty,
    total,
    completedColumns,
    completedRows,
    completedColors
  };
}

export function updateAreaClaims(state: NochMalGameState, playerIds: string[]): NochMalGameState {
  const claimedColumns = [...state.claimedColumns];
  const claimedColors = [...state.claimedColors];

  for (const playerId of playerIds) {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) continue;
    const score = calculateScore(player, state.layout, state);

    for (const column of score.completedColumns) {
      if (player.completedColumns.includes(column)) continue;
      const existing = claimedColumns.find((claim) => claim.index === column);
      if (existing) {
        if (!existing.playerIds.includes(player.id)) existing.playerIds.push(player.id);
      } else {
        claimedColumns.push({ index: column, playerIds: [player.id], first: true });
      }
      player.completedColumns.push(column);
    }

    for (const color of score.completedColors) {
      if (player.completedColors.includes(color)) continue;
      const existing = claimedColors.find((claim) => claim.color === color);
      if (existing) {
        if (!existing.playerIds.includes(player.id)) existing.playerIds.push(player.id);
      } else {
        claimedColors.push({ color, playerIds: [player.id], first: true });
      }
      player.completedColors.push(color);
    }

    player.completedRows = score.completedRows;
  }

  return { ...state, claimedColumns, claimedColors };
}

export function rankPlayers(players: NochMalPlayer[]): { playerId: string; name: string; score: number; rank: number }[] {
  const sorted = [...players].sort((a, b) => b.score.total - a.score.total || a.usedJokers - b.usedJokers || a.name.localeCompare(b.name));
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((player, index) => {
    if (lastScore !== player.score.total) {
      lastRank = index + 1;
      lastScore = player.score.total;
    }
    return { playerId: player.id, name: player.name, score: player.score.total, rank: lastRank };
  });
}

export function remainingJokers(player: NochMalPlayer): number {
  return Math.max(0, maxJokers - player.usedJokers);
}


