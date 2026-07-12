import type { CellColor, ColorDieResult, DiceRoll, NumberDieResult, SpecialAction } from '../types.ts';
import { colorList } from '../data/boardLayouts.ts';

const numberFaces: Array<number | 'joker'> = [1, 2, 3, 4, 5, 'joker'];
const specialFaces: SpecialAction[] = ['none', 'colorBonus', 'numberBonus', 'extraSelection', 'rowBonus', 'columnBonus'];

export function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export function randomFloat(seed: number): { seed: number; value: number } {
  const newSeed = nextSeed(seed);
  return { seed: newSeed, value: newSeed / 0x100000000 };
}

function pick<T>(items: T[], seed: number): { seed: number; value: T } {
  const next = randomFloat(seed);
  return { seed: next.seed, value: items[Math.floor(next.value * items.length)] ?? items[0] };
}

export function createSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function rollDice(seed = createSeed(), options: { solo?: boolean } = {}): DiceRoll {
  let currentSeed = seed;
  const colorFaces: Array<CellColor | 'joker'> = [...colorList(), 'joker'];
  const colorCount = options.solo ? 2 : 3;
  const numberCount = options.solo ? 2 : 3;

  const colorDice: ColorDieResult[] = Array.from({ length: colorCount }, (_, index) => {
    const result = pick(colorFaces, currentSeed);
    currentSeed = result.seed;
    return { id: `c${index}-${currentSeed}`, type: 'color', value: result.value };
  });

  const numberDice: NumberDieResult[] = Array.from({ length: numberCount }, (_, index) => {
    const result = pick(numberFaces, currentSeed);
    currentSeed = result.seed;
    return { id: `n${index}-${currentSeed}`, type: 'number', value: result.value };
  });

  const special = pick(specialFaces, currentSeed);
  currentSeed = special.seed;

  return {
    id: `roll-${seed}-${currentSeed}`,
    seed,
    colorDice,
    numberDice,
    specialDie: { id: `s-${currentSeed}`, type: 'special', value: special.value }
  };
}

export function reserveDice(roll: DiceRoll, playerId: string, colorDieId: string, numberDieId: string): DiceRoll {
  return {
    ...roll,
    colorDice: roll.colorDice.map((die) => (die.id === colorDieId ? { ...die, reservedBy: playerId } : die)),
    numberDice: roll.numberDice.map((die) => (die.id === numberDieId ? { ...die, reservedBy: playerId } : die))
  };
}

export function availableColorDice(roll: DiceRoll, playerId: string, unrestricted: boolean): ColorDieResult[] {
  return roll.colorDice.filter((die) => unrestricted || !die.reservedBy || die.reservedBy === playerId);
}

export function availableNumberDice(roll: DiceRoll, playerId: string, unrestricted: boolean): NumberDieResult[] {
  return roll.numberDice.filter((die) => unrestricted || !die.reservedBy || die.reservedBy === playerId);
}


