/**
 * Gemeinsame Beschreibung der Runden-Statistiken (Server berechnet, Client zeigt an).
 *
 * @typedef {'count' | 'percent' | 'points'} StatFormat
 * @typedef {{ key: string, label: string, format?: StatFormat, best?: 'max' | 'min' }} StatDef
 * @typedef {{ id: string, name: string, stats: Record<string, number> }} RoundStatPlayer
 * @typedef {{
 *   id: string,
 *   gameId: string,
 *   gameName: string,
 *   round: number | null,
 *   startedAt: string,
 *   finishedAt: string,
 *   durationMs: number,
 *   winnerIds: string[],
 *   isDraw: boolean,
 *   players: RoundStatPlayer[]
 * }} RoundRecord
 */

/** Für alle rundenbasierten Spiele. @type {StatDef} */
export const TURNS_STAT = { key: 'turns', label: 'Züge' };

/** Spielspezifische Werte in Anzeigereihenfolge. @type {Record<string, StatDef[]>} */
export const GAME_STATS = {
  kunterbunt: [
    { key: 'cardsPlayed', label: 'Karten gelegt', best: 'max' },
    { key: 'cardsDrawn', label: 'Karten gezogen', best: 'min' },
    { key: 'actionCards', label: 'Aktionskarten', best: 'max' },
    { key: 'buntCalls', label: '„Bunt!“ gerufen' },
    { key: 'buntForgotten', label: '„Bunt!“ vergessen', best: 'min' },
    { key: 'cardsLeft', label: 'Karten übrig', best: 'min' }
  ],
  skyjo: [
    { key: 'roundPoints', label: 'Rundenpunkte', format: 'points', best: 'min' },
    { key: 'drawnFromDeck', label: 'Vom Stapel gezogen' },
    { key: 'takenFromDiscard', label: 'Von der Ablage genommen' },
    { key: 'cardsCleared', label: 'Karten abgeräumt', best: 'max' }
  ],
  'schiffe-versenken': [
    { key: 'shots', label: 'Schüsse' },
    { key: 'hits', label: 'Treffer', best: 'max' },
    { key: 'accuracy', label: 'Trefferquote', format: 'percent', best: 'max' },
    { key: 'shipsSunk', label: 'Schiffe versenkt', best: 'max' }
  ],
  wuerfelblock: [
    { key: 'points', label: 'Punkte', format: 'points', best: 'max' },
    { key: 'rolls', label: 'Würfe' },
    { key: 'strikes', label: 'Gestrichen', best: 'min' }
  ],
  'noch-mal': [
    { key: 'points', label: 'Punkte', format: 'points', best: 'max' },
    { key: 'crosses', label: 'Kreuze', best: 'max' },
    { key: 'jokers', label: 'Joker benutzt', best: 'min' },
    { key: 'skipped', label: 'Ausgesetzt' }
  ],
  'ab-nach-hause': [
    { key: 'rolls', label: 'Würfe' },
    { key: 'piecesHome', label: 'Figuren im Ziel', best: 'max' },
    { key: 'captures', label: 'Rausgeworfen', best: 'max' },
    { key: 'wasCaptured', label: 'Selbst rausgeflogen', best: 'min' }
  ],
  'sudoku-duell': [
    { key: 'solved', label: 'Felder gelöst', best: 'max' },
    { key: 'mistakes', label: 'Fehler', best: 'min' }
  ],
  'vier-in-einer-reihe': [],
  'tic-tac-toe': []
};

/**
 * Sichtbare Werte einer Runde: Züge nur, wenn sie gezählt wurden (Sudoku/Noch mal laufen gleichzeitig).
 * @param {RoundRecord} round
 * @returns {StatDef[]}
 */
export function statDefsFor(round) {
  const defs = GAME_STATS[round.gameId] ?? [];
  const hasTurns = round.players.some((player) => (player.stats.turns ?? 0) > 0);
  return hasTurns ? [TURNS_STAT, ...defs] : defs;
}

/**
 * @param {number | undefined} value
 * @param {StatFormat} [format]
 */
export function formatStat(value, format) {
  if (value === undefined || value === null || Number.isNaN(value)) return '–';
  if (format === 'percent') return `${Math.round(value)} %`;
  return new Intl.NumberFormat('de-DE').format(value);
}

/** @param {number} ms */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours} Std. ${minutes} Min.`;
  if (minutes) return seconds ? `${minutes} Min. ${seconds} s` : `${minutes} Min.`;
  return `${seconds} s`;
}

/**
 * Spieler-IDs mit dem besten Wert (nur wenn sich die Werte unterscheiden).
 * @param {RoundStatPlayer[]} players
 * @param {StatDef} def
 */
export function bestPlayerIds(players, def) {
  if (!def.best || players.length < 2) return new Set();
  const values = players.map((player) => player.stats[def.key]).filter((value) => typeof value === 'number');
  if (values.length < 2 || values.every((value) => value === values[0])) return new Set();
  const target = def.best === 'max' ? Math.max(...values) : Math.min(...values);
  return new Set(players.filter((player) => player.stats[def.key] === target).map((player) => player.id));
}
