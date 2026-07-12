import type { CellColor, NochMalGameState, SelectedDice, ValidMove } from '../types.ts';
import { colorList } from '../data/boardLayouts.ts';
import { availableColorDice, availableNumberDice } from './dice.ts';
import { getValidMoves } from './moves.ts';
import { canUseUnrestrictedDice, selectDice } from './gameState.ts';

export interface AiChoice {
  selectedDice: SelectedDice;
  move: ValidMove;
}

function numberChoices(value: number | 'joker'): number[] {
  return value === 'joker' ? [1, 2, 3, 4, 5] : [value];
}

function colorChoices(value: CellColor | 'joker'): CellColor[] {
  return value === 'joker' ? colorList() : [value];
}

export function getAiChoice(state: NochMalGameState): AiChoice | null {
  if (!state.currentRoll) return null;
  const player = state.players[state.actingPlayerIndex];
  const unrestricted = canUseUnrestrictedDice(state);
  const choices: AiChoice[] = [];

  for (const colorDie of availableColorDice(state.currentRoll, player.id, unrestricted)) {
    for (const numberDie of availableNumberDice(state.currentRoll, player.id, unrestricted)) {
      for (const colorChoice of colorChoices(colorDie.value)) {
        for (const numberChoice of numberChoices(numberDie.value)) {
          const selectedDice = selectDice(state, colorDie.id, numberDie.id, { colorChoice, numberChoice }).selectedDice;
          if (!selectedDice) continue;
          const moves = getValidMoves(player.board, selectedDice, state.layout, player.usedJokers);
          for (const move of moves.slice(0, 6)) choices.push({ selectedDice, move });
        }
      }
    }
  }

  if (!choices.length) return null;
  const difficulty = player.aiDifficulty ?? state.settings.aiDifficulty;
  const scored = choices.map((choice) => {
    const jokerPenalty = (choice.selectedDice.usesColorJoker ? 2 : 0) + (choice.selectedDice.usesNumberJoker ? 2 : 0);
    const longTerm = difficulty === 'hard' ? choice.move.cellIds.length * 2 : difficulty === 'medium' ? choice.move.cellIds.length : 0;
    return { choice, score: choice.move.scoreEstimate + longTerm - jokerPenalty };
  });
  scored.sort((a, b) => b.score - a.score);
  if (difficulty === 'easy' && scored.length > 1) return scored[Math.min(2, scored.length - 1)].choice;
  return scored[0].choice;
}


