import type { CellColor, SpecialAction } from '../types.ts';

export const colorLabels: Record<CellColor, string> = {
  yellow: 'Gelb',
  green: 'Gruen',
  blue: 'Blau',
  red: 'Rot',
  purple: 'Lila'
};

export const colorSymbols: Record<CellColor, string> = {
  yellow: 'S',
  green: 'B',
  blue: 'W',
  red: 'F',
  purple: 'D'
};

export const colorClasses: Record<CellColor, string> = {
  yellow: 'bg-amber-100 text-amber-950 border-amber-300',
  green: 'bg-emerald-100 text-emerald-950 border-emerald-300',
  blue: 'bg-sky-100 text-sky-950 border-sky-300',
  red: 'bg-rose-100 text-rose-950 border-rose-300',
  purple: 'bg-violet-100 text-violet-950 border-violet-300'
};

export const specialActionLabels: Record<SpecialAction, string> = {
  none: 'Keine Aktion',
  colorBonus: 'Farbbonus',
  numberBonus: '+1 Feld',
  extraSelection: 'Freier Anschluss',
  rowBonus: 'Reihenbonus',
  columnBonus: 'Spaltenbonus'
};

export const specialActionDescriptions: Record<SpecialAction, string> = {
  none: 'Kein Zusatzeffekt in diesem Zug.',
  colorBonus: 'Bei einem legalen Zug erhaeltst du 2 Bonuspunkte fuer die gewaehlte Farbe.',
  numberBonus: 'Du darfst genau ein Feld mehr markieren, maximal fuenf.',
  extraSelection: 'Die Gruppe darf in der Startspalte beginnen, auch wenn du schon angrenzende Felder hast.',
  rowBonus: 'Bei einem legalen Zug erhaeltst du 3 Bonuspunkte, wenn dadurch eine Reihe voll wird.',
  columnBonus: 'Bei einem legalen Zug erhaeltst du 3 Bonuspunkte, wenn dadurch eine Spalte voll wird.'
};

export const defaultSettings = {
  playerCount: 1,
  playerNames: ['Spieler 1'],
  layoutId: 'city-lights',
  animations: true,
  sound: false,
  hints: true,
  confirmBeforeCommit: true,
  colorSymbols: true,
  aiDifficulty: 'medium',
  aiPlayers: 0,
  allowUndoLastMove: false,
  soloRounds: 30
} as const;

export const maxJokers = 8;
export const saveVersion = 1;


