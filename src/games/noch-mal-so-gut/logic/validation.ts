import type { BoardCell, CellColor, MoveValidationResult, SelectedDice } from '../types.ts';
import { allCells, getCell } from '../data/boardLayouts.ts';
import { maxJokers } from '../data/gameConfig.ts';

function neighborIds(cell: BoardCell): string[] {
  return [`${cell.row - 1}:${cell.column}`, `${cell.row + 1}:${cell.column}`, `${cell.row}:${cell.column - 1}`, `${cell.row}:${cell.column + 1}`];
}

export function areCellsConnected(board: BoardCell[][], cellIds: string[]): boolean {
  if (cellIds.length === 0) return false;
  const wanted = new Set(cellIds);
  const seen = new Set<string>();
  const queue = [cellIds[0]];

  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cell = getCell(board, id);
    if (!cell) continue;
    for (const neighborId of neighborIds(cell)) {
      if (wanted.has(neighborId) && !seen.has(neighborId)) queue.push(neighborId);
    }
  }

  return seen.size === wanted.size;
}

export function hasAdjacentMarkedCell(board: BoardCell[][], cellIds: string[]): boolean {
  const selected = new Set(cellIds);
  return cellIds.some((id) => {
    const cell = getCell(board, id);
    if (!cell) return false;
    return neighborIds(cell).some((neighborId) => {
      if (selected.has(neighborId)) return false;
      return Boolean(getCell(board, neighborId)?.marked);
    });
  });
}

export function hasAnyMarkedCell(board: BoardCell[][]): boolean {
  return allCells(board).some((cell) => cell.marked);
}

export function startsInStartColumn(board: BoardCell[][], cellIds: string[], startColumn: number): boolean {
  return cellIds.some((id) => getCell(board, id)?.column === startColumn);
}

export function validateCellSelection(
  board: BoardCell[][],
  cellIds: string[],
  selectedDice: SelectedDice,
  startColumn: number,
  usedJokers: number
): MoveValidationResult {
  const uniqueIds = [...new Set(cellIds)];
  if (uniqueIds.length !== cellIds.length) return { valid: false, reason: 'Ein Feld wurde mehrfach ausgewaehlt.' };
  if (uniqueIds.length !== selectedDice.count) return { valid: false, reason: `Markiere genau ${selectedDice.count} Felder.` };

  const cells = uniqueIds.map((id) => getCell(board, id));
  if (cells.some((cell) => !cell)) return { valid: false, reason: 'Mindestens ein Feld existiert nicht.' };
  const typedCells = cells.filter(Boolean) as BoardCell[];
  if (typedCells.some((cell) => cell.marked)) return { valid: false, reason: 'Bereits markierte Felder duerfen nicht erneut markiert werden.' };
  if (typedCells.some((cell) => cell.color !== selectedDice.color)) return { valid: false, reason: 'Alle Felder muessen die gewaehlte Farbe haben.' };
  if (!areCellsConnected(board, uniqueIds)) return { valid: false, reason: 'Die Felder muessen orthogonal zusammenhaengen.' };

  const jokerCost = (selectedDice.usesColorJoker ? 1 : 0) + (selectedDice.usesNumberJoker ? 1 : 0);
  if (usedJokers + jokerCost > maxJokers) return { valid: false, reason: 'Du hast keine Jokerfelder mehr frei.' };

  const emptyBoard = !hasAnyMarkedCell(board);
  const startsAllowed = startsInStartColumn(board, uniqueIds, startColumn);
  if (emptyBoard && !startsAllowed) return { valid: false, reason: 'Der erste Eintrag muss in der Startspalte H liegen.' };
  if (!emptyBoard && !startsAllowed && !hasAdjacentMarkedCell(board, uniqueIds)) {
    return { valid: false, reason: 'Die Auswahl muss an eigene Felder angrenzen oder in der Startspalte beginnen.' };
  }

  return { valid: true };
}

export function colorCells(board: BoardCell[][], color: CellColor): BoardCell[] {
  return allCells(board).filter((cell) => cell.color === color && !cell.marked);
}


