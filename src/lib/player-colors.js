/** Feste Spielerfarben (Identität, nicht Daten). Schlüssel = Werte aus parties.js `playerColors`. */
export const PLAYER_COLOR_HEX = /** @type {Record<string, string>} */ ({
  cyan: '#0891b2',
  violet: '#7c3aed',
  rose: '#e11d48',
  emerald: '#059669',
  orange: '#ea580c',
  blue: '#2563eb',
  amber: '#d97706',
  lime: '#65a30d',
  teal: '#0d9488',
  sky: '#0284c7',
  fuchsia: '#c026d3',
  red: '#dc2626'
});

/** @param {string | null | undefined} color */
export function playerHex(color) {
  return PLAYER_COLOR_HEX[color ?? ''] ?? '#64748b';
}

/**
 * Hex-Farbe eines Spielers über seine ID, aus der Party-Spielerliste.
 * @param {{ id: string, color?: string }[]} partyPlayers
 * @param {string} playerId
 */
export function playerHexById(partyPlayers, playerId) {
  return playerHex(partyPlayers.find((player) => player.id === playerId)?.color);
}

/** @param {string | null | undefined} name */
export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}
