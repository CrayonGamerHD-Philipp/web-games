import type { BoardCell, BoardCellDefinition, BoardLayout, CellColor } from '../types.ts';

const colors: CellColor[] = ['yellow', 'green', 'blue', 'red', 'purple'];

// Fester Spielplan, strukturell dem fotografierten Blatt nachempfunden, aber als eigene digitale Daten definiert.
const pattern: CellColor[][] = [
  ['purple', 'purple', 'red', 'yellow', 'yellow', 'red', 'purple', 'green', 'yellow', 'green', 'yellow', 'red', 'purple', 'red', 'blue'],
  ['blue', 'yellow', 'yellow', 'red', 'yellow', 'red', 'purple', 'purple', 'blue', 'yellow', 'yellow', 'red', 'purple', 'red', 'blue'],
  ['blue', 'blue', 'green', 'yellow', 'red', 'red', 'purple', 'yellow', 'blue', 'purple', 'green', 'green', 'purple', 'red', 'green'],
  ['yellow', 'green', 'blue', 'yellow', 'red', 'red', 'blue', 'blue', 'red', 'red', 'green', 'green', 'yellow', 'yellow', 'green'],
  ['green', 'green', 'blue', 'blue', 'green', 'blue', 'blue', 'blue', 'yellow', 'yellow', 'blue', 'red', 'green', 'green', 'yellow'],
  ['green', 'purple', 'purple', 'blue', 'green', 'green', 'blue', 'yellow', 'yellow', 'red', 'red', 'purple', 'green', 'yellow', 'yellow'],
  ['yellow', 'green', 'red', 'red', 'purple', 'green', 'green', 'yellow', 'purple', 'red', 'blue', 'blue', 'red', 'green', 'yellow']
];

const stars = new Set(['0:2', '0:6', '0:10', '1:5', '1:9', '2:3', '2:12', '3:4', '3:7', '3:14', '4:1', '4:8', '5:6', '5:13', '6:0', '6:11']);

function createCells(): BoardCellDefinition[][] {
  return pattern.map((row, rowIndex) =>
    row.map((color, column) => ({
      row: rowIndex,
      column,
      color,
      hasStar: stars.has(`${rowIndex}:${column}`)
    }))
  );
}

export const boardLayouts: BoardLayout[] = [
  {
    id: 'city-lights',
    name: 'Festes Blatt',
    rows: 7,
    columns: 15,
    cells: createCells(),
    columnLabels: Array.from({ length: 15 }, (_, index) => String.fromCharCode(65 + index)),
    rowLabels: ['P', 'Q', 'R', 'S', 'T', 'U', 'V'],
    columnScoresFirst: [5, 5, 5, 5, 5, 5, 5, 0, 2, 2, 2, 3, 3, 3, 5],
    columnScoresLater: [3, 3, 3, 2, 2, 1, 1, 0, 1, 1, 2, 2, 2, 3, 3],
    rowScores: [5, 4, 3, 2, 1, 0, 0],
    colorScoresFirst: {
      yellow: 5,
      green: 5,
      blue: 5,
      red: 5,
      purple: 5
    },
    colorScoresLater: {
      yellow: 3,
      green: 3,
      blue: 3,
      red: 3,
      purple: 3
    },
    startColumn: 7
  }
];

export function getBoardLayout(layoutId: string): BoardLayout {
  return boardLayouts.find((layout) => layout.id === layoutId) ?? boardLayouts[0];
}

export function createPlayerBoard(layout: BoardLayout): BoardCell[][] {
  return layout.cells.map((row) =>
    row.map((cell) => ({
      ...cell,
      id: cellId(cell.row, cell.column),
      marked: false
    }))
  );
}

export function cellId(row: number, column: number): string {
  return `${row}:${column}`;
}

export function parseCellId(id: string): { row: number; column: number } | null {
  const [rowText, columnText] = id.split(':');
  const row = Number(rowText);
  const column = Number(columnText);
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  return { row, column };
}

export function getCell(board: BoardCell[][], id: string): BoardCell | null {
  const parsed = parseCellId(id);
  if (!parsed) return null;
  return board[parsed.row]?.[parsed.column] ?? null;
}

export function allCells(board: BoardCell[][]): BoardCell[] {
  return board.flat();
}

export function colorList(): CellColor[] {
  return [...colors];
}
