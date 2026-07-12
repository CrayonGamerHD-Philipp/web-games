export type TicTacToeMark = 'X' | 'O';

export interface TicTacToePlayer {
  id: string;
  name: string;
  mark: TicTacToeMark;
}

export interface TicTacToeState {
  board: (TicTacToeMark | null)[];
  currentPlayerId: string | null;
  winnerId: string | null;
  winningLine: number[];
  isDraw: boolean;
}

export interface TicTacToeSession {
  id: string;
  gameId: 'tic-tac-toe';
  name: string;
  status: 'running' | 'finished';
  createdAt: string;
  players: TicTacToePlayer[];
  state: TicTacToeState;
}

export interface TicTacToeMove {
  cellIndex: number;
}
