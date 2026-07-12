// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerBoard, getBoardLayout } from '../data/boardLayouts.ts';
import { rollDice } from '../logic/dice.ts';
import { createGame, rollCurrentDice, selectDice, selectCells, confirmMove, skipMove, serializeGame, loadGame } from '../logic/gameState.ts';
import { getValidMoves } from '../logic/moves.ts';
import { calculateScore } from '../logic/scoring.ts';
import { validateCellSelection } from '../logic/validation.ts';

const layout = getBoardLayout('city-lights');

function selected(color = 'yellow', count = 1) {
  return { colorDieId: 'c', numberDieId: 'n', color, count, usesColorJoker: false, usesNumberJoker: false, specialAction: 'none' };
}

test('dice values stay in allowed ranges and are reproducible', () => {
  const a = rollDice(1234);
  const b = rollDice(1234);
  assert.deepEqual(a, b);
  assert.equal(a.colorDice.length, 3);
  assert.equal(a.numberDice.length, 3);
  assert.ok(a.colorDice.every((die) => die.value === 'joker' || ['yellow', 'green', 'blue', 'red', 'purple'].includes(die.value)));
  assert.ok(a.numberDice.every((die) => die.value === 'joker' || (die.value >= 1 && die.value <= 5)));
});

test('valid connected same-color group in start column is accepted', () => {
  const board = createPlayerBoard(layout);
  const dice = selected(board[3][7].color, 1);
  const result = validateCellSelection(board, ['3:7'], dice, layout.startColumn, 0);
  assert.equal(result.valid, true);
});

test('diagonal or wrong color groups are rejected', () => {
  const board = createPlayerBoard(layout);
  const dice = selected(board[0][0].color, 2);
  assert.equal(validateCellSelection(board, ['0:0', '1:1'], dice, layout.startColumn, 0).valid, false);
  assert.equal(validateCellSelection(board, ['0:0', '0:2'], dice, layout.startColumn, 0).valid, false);
});

test('already marked cells cannot be selected again', () => {
  const board = createPlayerBoard(layout);
  board[3][7].marked = true;
  const dice = selected(board[3][7].color, 1);
  const result = validateCellSelection(board, ['3:7'], dice, layout.startColumn, 0);
  assert.equal(result.valid, false);
});

test('first move must touch start column and later move may connect orthogonally', () => {
  const board = createPlayerBoard(layout);
  const away = board[0][0];
  assert.equal(validateCellSelection(board, [away.id], selected(away.color, 1), layout.startColumn, 0).valid, false);
  board[3][7].marked = true;
  const neighbor = board[3][8];
  assert.equal(validateCellSelection(board, [neighbor.id], selected(neighbor.color, 1), layout.startColumn, 0).valid, true);
});

test('jokers are limited', () => {
  const board = createPlayerBoard(layout);
  const cell = board[3][7];
  const dice = { ...selected(cell.color, 1), usesColorJoker: true, usesNumberJoker: true };
  assert.equal(validateCellSelection(board, [cell.id], dice, layout.startColumn, 7).valid, false);
});

test('valid move finder returns connected legal groups', () => {
  const board = createPlayerBoard(layout);
  const dice = selected(board[3][7].color, 1);
  const moves = getValidMoves(board, dice, layout, 0);
  assert.ok(moves.some((move) => move.cellIds.includes('3:7')));
});

test('confirming a move marks cells, advances turn, and stores history', () => {
  let state = createGame({ playerCount: 1, soloRounds: 30 });
  state = rollCurrentDice(state, 42);
  state.currentRoll.colorDice[0].value = 'joker';
  state.currentRoll.numberDice[0].value = 'joker';
  state.currentRoll.specialDie.value = 'none';
  state = selectDice(state, state.currentRoll.colorDice[0].id, state.currentRoll.numberDice[0].id, { colorChoice: state.players[0].board[3][7].color, numberChoice: 1 });
  const move = getValidMoves(state.players[0].board, state.selectedDice, state.layout, 0).find((candidate) => candidate.cellIds.includes('3:7'));
  assert.ok(move);
  state = selectCells(state, move.cellIds);
  state = confirmMove(state);
  assert.equal(state.history.length, 1);
  assert.ok(move.cellIds.every((id) => {
    const [row, column] = id.split(':').map(Number);
    return state.players[0].board[row][column].marked;
  }));
});

test('row, column, color, star and joker scoring is calculated from state', () => {
  const state = createGame({ playerCount: 1 });
  const player = state.players[0];
  for (const row of player.board) row[0].marked = true;
  for (const cell of player.board[0]) cell.marked = true;
  for (const row of player.board) for (const cell of row) if (cell.color === 'yellow') cell.marked = true;
  player.usedJokers = 4;
  const score = calculateScore(player, state.layout, state);
  assert.ok(score.columnPoints > 0);
  assert.ok(score.rowPoints > 0);
  assert.ok(score.colorPoints > 0);
  assert.equal(score.jokerPenalty, 4);
  assert.ok(Number.isFinite(score.total));
});

test('solo game ends after configured rounds and cannot finish twice differently', () => {
  let state = createGame({ playerCount: 1, soloRounds: 1 });
  state = skipMove(state);
  assert.equal(state.phase, 'finished');
  const finishedAt = state.finishedAt;
  state = skipMove(state);
  assert.equal(state.finishedAt, finishedAt);
});

test('save and load roundtrip keeps same state', () => {
  const state = createGame({ playerCount: 2 });
  const loaded = loadGame(serializeGame(state));
  assert.deepEqual(loaded, state);
});







