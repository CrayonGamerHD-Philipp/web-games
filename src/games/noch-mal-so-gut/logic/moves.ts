import type { BoardCell, BoardLayout, CellColor, ScoreBreakdown, SelectedDice, ValidMove } from '../types.ts';
import { allCells, getCell } from '../data/boardLayouts.ts';
import { validateCellSelection } from './validation.ts';

function neighbors(board: BoardCell[][], cell: BoardCell, color: CellColor): BoardCell[] {
  const ids = [`${cell.row - 1}:${cell.column}`, `${cell.row + 1}:${cell.column}`, `${cell.row}:${cell.column - 1}`, `${cell.row}:${cell.column + 1}`];
  return ids
    .map((id) => getCell(board, id))
    .filter((candidate): candidate is BoardCell => Boolean(candidate && !candidate.marked && candidate.color === color));
}

function estimateMove(cells: BoardCell[], layout: BoardLayout): number {
  const columns = new Set(cells.map((cell) => cell.column));
  const rows = new Set(cells.map((cell) => cell.row));
  return cells.length + cells.filter((cell) => cell.hasStar).length * 2 + columns.size + rows.size + (cells.some((cell) => cell.column === layout.startColumn) ? 1 : 0);
}

export function getValidMoves(board: BoardCell[][], selectedDice: SelectedDice, layout: BoardLayout, usedJokers: number): ValidMove[] {
  const target = selectedDice.count;
  const moves = new Map<string, ValidMove>();
  const starts = allCells(board).filter((cell) => !cell.marked && cell.color === selectedDice.color);

  for (const start of starts) {
    const stack: BoardCell[][] = [[start]];
    while (stack.length) {
      const group = stack.pop() ?? [];
      if (group.length === target) {
        const cellIds = group.map((cell) => cell.id).sort();
        const key = cellIds.join('|');
        if (!moves.has(key) && validateCellSelection(board, cellIds, selectedDice, layout.startColumn, usedJokers).valid) {
          moves.set(key, { cellIds, scoreEstimate: estimateMove(group, layout) });
        }
        continue;
      }

      const seen = new Set(group.map((cell) => cell.id));
      const fringe = group.flatMap((cell) => neighbors(board, cell, selectedDice.color)).filter((cell) => !seen.has(cell.id));
      for (const next of fringe) {
        stack.push([...group, next]);
      }
    }
  }

  return [...moves.values()].sort((a, b) => b.scoreEstimate - a.scoreEstimate || a.cellIds.join('').localeCompare(b.cellIds.join('')));
}

export function explainSelection(board: BoardCell[][], cellIds: string[], selectedDice: SelectedDice | null, layout: BoardLayout, usedJokers: number): string {
  if (!selectedDice) return 'Waehle zuerst einen Farb- und einen Zahlenwuerfel.';
  const result = validateCellSelection(board, cellIds, selectedDice, layout.startColumn, usedJokers);
  return result.valid ? 'Diese Auswahl ist gueltig. Du kannst sie bestaetigen.' : result.reason ?? 'Diese Auswahl ist nicht gueltig.';
}


