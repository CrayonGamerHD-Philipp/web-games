// Gemeinsame Definitionen für Avatare, Reaktionen und Spieleinstellungen (Client + Server).

/** Anzahl der Varianten je Avatar-Teil. Werte sind Indizes 0..n-1. */
export const AVATAR_PARTS = /** @type {const} */ ({
  shape: 6,
  eyes: 6,
  mouth: 6,
  accessory: 8
});

/** @typedef {{ shape: number, eyes: number, mouth: number, accessory: number }} Avatar */

/** @returns {Avatar} */
export function randomAvatar() {
  const pick = (/** @type {number} */ n) => Math.floor(Math.random() * n);
  return { shape: pick(AVATAR_PARTS.shape), eyes: pick(AVATAR_PARTS.eyes), mouth: pick(AVATAR_PARTS.mouth), accessory: pick(AVATAR_PARTS.accessory) };
}

/**
 * Bereinigt einen Avatar aus Benutzereingaben; ungültige Teile werden ersetzt.
 * @param {unknown} input
 * @param {Avatar} [fallback]
 * @returns {Avatar}
 */
export function normalizeAvatar(input, fallback = randomAvatar()) {
  const source = /** @type {Record<string, unknown>} */ (input && typeof input === 'object' ? input : {});
  /** @type {Record<string, number>} */
  const result = {};
  for (const [key, count] of Object.entries(AVATAR_PARTS)) {
    const value = Number(source[key]);
    result[key] = Number.isInteger(value) && value >= 0 && value < count ? value : /** @type {Record<string, number>} */ (fallback)[key];
  }
  return /** @type {Avatar} */ (result);
}

/** Erlaubte Schnell-Reaktionen. */
export const REACTIONS = ['👍', '👏', '😂', '😮', '😍', '🔥', '😭', '🎉'];
/** So lange (ms) bleibt eine Reaktion sichtbar. */
export const REACTION_TTL_MS = 4000;

/**
 * @typedef {{ value: string | number, label: string }} SettingOption
 * @typedef {{ key: string, label: string, description?: string, type: 'toggle', default: boolean } | { key: string, label: string, description?: string, type: 'choice', options: SettingOption[], default: string | number }} GameSetting
 */

/** Einstellungen pro Spiel, die der Host in der Lobby wählen kann. @type {Record<string, GameSetting[]>} */
export const GAME_SETTINGS = {
  skyjo: [
    { key: 'playToHundred', label: 'Bis 100 Punkte spielen', description: 'Mehrere Runden, bis jemand 100 Punkte erreicht. Wer dann am wenigsten hat, gewinnt.', type: 'toggle', default: false }
  ],
  'sudoku-duell': [
    {
      key: 'difficulty',
      label: 'Schwierigkeit',
      type: 'choice',
      options: [
        { value: 'leicht', label: 'Leicht' },
        { value: 'mittel', label: 'Mittel' },
        { value: 'schwer', label: 'Schwer' }
      ],
      default: 'mittel'
    }
  ],
  kunterbunt: [
    {
      key: 'handSize',
      label: 'Karten zu Beginn',
      type: 'choice',
      options: [
        { value: 5, label: '5 – kurz' },
        { value: 7, label: '7 – normal' },
        { value: 10, label: '10 – lang' }
      ],
      default: 7
    }
  ],
  'ab-nach-hause': [
    {
      key: 'items',
      label: 'Items & Glücksfelder',
      description: 'Auf ?-Feldern gibt es Items wie Turbo, Schutzschild, Gewitter oder Falle. Wer hinten liegt, bekommt die stärkeren.',
      type: 'toggle',
      default: false
    }
  ],
  'noch-mal': [
    {
      key: 'mode',
      label: 'Regeln',
      description: 'Erweitert: Sonderwürfel, Zeilenwertung, Herzen und Bomben.',
      type: 'choice',
      options: [
        { value: 'erweitert', label: 'Erweitert' },
        { value: 'klassisch', label: 'Klassisch' }
      ],
      default: 'erweitert'
    },
    {
      key: 'boardSize',
      label: 'Spielfeld',
      description: 'Jede Runde wird ein neues Spielfeld erzeugt.',
      type: 'choice',
      options: [
        { value: 'klein', label: 'Klein 11×5' },
        { value: 'normal', label: 'Normal 15×7' },
        { value: 'gross', label: 'Groß 19×9' }
      ],
      default: 'normal'
    }
  ],
  'auf-und-ab': [
    {
      key: 'stockSize',
      label: 'Vorratsstapel',
      description: 'Ab 5 Spielern höchstens 20 Karten.',
      type: 'choice',
      options: [
        { value: 10, label: '10 – kurz' },
        { value: 20, label: '20' },
        { value: 30, label: '30 – normal' }
      ],
      default: 30
    }
  ],
  moosgeister: [
    {
      key: 'durchgaenge',
      label: 'Durchgänge',
      type: 'choice',
      options: [
        { value: 1, label: '1 – kurz' },
        { value: 3, label: '3 – normal' }
      ],
      default: 3
    }
  ],
  'schiffe-versenken': [
    { key: 'extraShotOnHit', label: 'Nach Treffer nochmal schießen', description: 'Aus: Nach jedem Schuss ist der andere dran.', type: 'toggle', default: true }
  ]
};

/**
 * Lässt nur bekannte Einstellungen mit gültigen Werten durch; fehlende bekommen den Standard.
 * @param {string} gameId
 * @param {unknown} raw
 * @returns {Record<string, string | number | boolean>}
 */
export function sanitizeGameSettings(gameId, raw) {
  const source = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  /** @type {Record<string, string | number | boolean>} */
  const result = {};
  for (const setting of GAME_SETTINGS[gameId] ?? []) {
    const value = source[setting.key];
    if (setting.type === 'toggle') {
      result[setting.key] = typeof value === 'boolean' ? value : setting.default;
    } else {
      const match = setting.options.find((option) => String(option.value) === String(value));
      result[setting.key] = match ? match.value : setting.default;
    }
  }
  return result;
}
