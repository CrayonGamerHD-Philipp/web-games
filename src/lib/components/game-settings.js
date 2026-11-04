// Hilfen für Spieleinstellungen in der Oberfläche (Lobby-Formular, Zusammenfassungen, Merken pro Spiel).

/** @typedef {import('$lib/party-features.js').GameSetting} GameSetting */
/** @typedef {Record<string, string | number | boolean>} SettingValues */

/**
 * @param {GameSetting[] | undefined} schema
 * @returns {SettingValues}
 */
export function defaultSettings(schema) {
  /** @type {SettingValues} */
  const values = {};
  for (const setting of schema ?? []) values[setting.key] = setting.default;
  return values;
}

/**
 * Nur gültige Werte übernehmen, fehlende mit dem Standard füllen.
 * @param {GameSetting[] | undefined} schema
 * @param {unknown} raw
 * @returns {SettingValues}
 */
export function cleanSettings(schema, raw) {
  const source = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  /** @type {SettingValues} */
  const values = {};
  for (const setting of schema ?? []) {
    const value = source[setting.key];
    if (setting.type === 'toggle') {
      values[setting.key] = typeof value === 'boolean' ? value : setting.default;
    } else {
      const match = setting.options.find((option) => String(option.value) === String(value));
      values[setting.key] = match ? match.value : setting.default;
    }
  }
  return values;
}

/** @param {string} gameId */
function storageKey(gameId) {
  return `web-games:game-settings:${gameId}`;
}

/**
 * Zuletzt gewählte Einstellungen des Hosts für ein Spiel (oder Standard).
 * @param {string} gameId
 * @param {GameSetting[] | undefined} schema
 */
export function loadStoredSettings(gameId, schema) {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    return cleanSettings(schema, raw ? JSON.parse(raw) : {});
  } catch {
    return defaultSettings(schema);
  }
}

/**
 * @param {string} gameId
 * @param {SettingValues} values
 */
export function storeSettings(gameId, values) {
  try {
    localStorage.setItem(storageKey(gameId), JSON.stringify(values));
  } catch {
    // Speicher voll oder gesperrt: dann eben ohne Merken.
  }
}

/**
 * Lesbarer Wert einer Einstellung, z. B. „Mittel“ oder „An“.
 * @param {GameSetting} setting
 * @param {unknown} value
 */
export function settingValueLabel(setting, value) {
  if (setting.type === 'toggle') return value ? 'An' : 'Aus';
  return setting.options.find((option) => String(option.value) === String(value))?.label ?? String(value ?? '');
}

/**
 * Zusammenfassung pro Einstellung: `text` ausführlich („Schwierigkeit: Mittel“),
 * `short` für Chips („Mittel“ bzw. bei Schaltern der Name oder „… aus“).
 * @param {GameSetting[] | undefined} schema
 * @param {Record<string, unknown> | null | undefined} values
 */
export function summarizeSettings(schema, values) {
  const clean = cleanSettings(schema, values ?? {});
  return (schema ?? []).map((setting) => {
    const value = clean[setting.key];
    const valueLabel = settingValueLabel(setting, value);
    return {
      key: setting.key,
      text: `${setting.label}: ${valueLabel}`,
      short: setting.type === 'toggle' ? (value ? setting.label : `${setting.label}: aus`) : valueLabel
    };
  });
}
