import { applyGameMove, availableGames, createGameSession, getGame, redactGameSession } from './games/index.js';
import { GAME_SETTINGS, REACTIONS, REACTION_TTL_MS, normalizeAvatar, randomAvatar, sanitizeGameSettings } from '../party-features.js';

/**
 * @typedef {import('../party-features.js').Avatar} Avatar
 * @typedef {{ id: string, token: string, name: string, isHost: boolean, joinedAt: string, score: number, color: string, avatar?: Avatar, lastReactionAt?: number }} Player
 * @typedef {{ id: string, playerId: string, emoji: string, at: number }} Reaction
 * @typedef {{ id: string, gameId: string, gameName: string, winnerIds: string[], isDraw: boolean, playerIds: string[], finishedAt: string }} HistoryEntry
 * @typedef {{ enabled?: boolean, targetScore?: number, round?: number, totalScores?: { playerId: string, score: number }[], lastRoundScores?: { playerId: string, score: number }[], matchFinished?: boolean, winnerIds?: string[] }} SkyjoMatch
 * @typedef {{ id: string, gameId: string, name: string, status: string, createdAt: string, players: { id: string, name: string, mark?: string }[], state: { currentPlayerId: string | null, winnerId: string | null, isDraw: boolean, roundScores?: { playerId: string, score: number }[], match?: SkyjoMatch, [key: string]: unknown }, requests: { rematch: string[], newGame: string[] }, scoreAwarded: boolean, resultRecorded?: boolean, settings?: Record<string, string | number | boolean> }} ActiveGame
 * @typedef {{ code: string, createdAt: string, players: Player[], activeGame: ActiveGame | null, locked?: boolean, lastActivityAt?: number, reactions?: Reaction[], history?: HistoryEntry[] }} Party
 * @typedef {{ parties: Map<string, Party>, listeners: Map<string, Set<(party: Party) => void>> }} Store
 */

function createStore() {
  /** @type {Store} */
  return {
    parties: new Map(),
    listeners: new Map()
  };
}

const globalStore = /** @type {typeof globalThis & { __web_games_party_store__?: Store, __web_games_party_sweep__?: ReturnType<typeof setInterval> }} */ (globalThis);
const store = globalStore.__web_games_party_store__ ?? createStore();
store.listeners ??= new Map();
globalStore.__web_games_party_store__ = store;

export const playerColors = ['cyan', 'violet', 'rose', 'emerald', 'orange', 'blue', 'amber', 'lime', 'teal', 'sky', 'fuchsia', 'red'];

const MAX_PARTIES = 500;
const MAX_LISTENERS_PER_PARTY = 40;
const PARTY_IDLE_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

/** @param {Party} party */
function touchParty(party) {
  party.lastActivityAt = Date.now();
}

function sweepStaleParties() {
  const cutoff = Date.now() - PARTY_IDLE_TTL_MS;

  for (const [code, party] of store.parties) {
    if ((party.lastActivityAt ?? 0) < cutoff) {
      store.parties.delete(code);
      store.listeners.delete(code);
    }
  }
}

if (!globalStore.__web_games_party_sweep__) {
  globalStore.__web_games_party_sweep__ = setInterval(sweepStaleParties, SWEEP_INTERVAL_MS);
}

/** @param {unknown} name */
function normalizeName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

/** @param {unknown} code */
function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** @param {unknown} playerId */
function normalizePlayerId(playerId) {
  return String(playerId ?? '').trim();
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join('');
  } while (store.parties.has(code));

  return code;
}

/**
 * @param {Party} party
 * @param {unknown} token
 */
function resolvePlayer(party, token) {
  const cleanToken = String(token ?? '').trim();
  if (!cleanToken) return null;
  return party.players.find((player) => player.token === cleanToken) ?? null;
}

/** @param {Party} party */
function normalizeParty(party) {
  party.locked ??= false;
  party.reactions ??= [];
  party.history ??= [];
  const usedColors = new Set();
  party.players = party.players.map((player, index) => {
    let color = playerColors.includes(player.color) && !usedColors.has(player.color) ? player.color : '';
    color ||= playerColors.find((candidate) => !usedColors.has(candidate)) ?? playerColors[index % playerColors.length];
    usedColors.add(color);
    const avatar = player.avatar ? normalizeAvatar(player.avatar) : randomAvatar();
    return { ...player, score: Number.isFinite(player.score) ? player.score : 0, color, avatar };
  });

  if (party.activeGame) {
    party.activeGame.requests ??= { rematch: [], newGame: [] };
    party.activeGame.scoreAwarded ??= false;
  }
}

/**
 * Strips hidden information from a cloned game before it leaves the server.
 * `viewerId` is the player the data is sent to (null = anonymous spectator).
 * @param {ActiveGame} game
 * @param {string | null} viewerId
 */
function redactActiveGame(game, viewerId) {
  if (game.gameId !== 'skyjo') {
    return /** @type {ActiveGame} */ (redactGameSession(game.gameId, game, viewerId));
  }

  {
    const state = /** @type {any} */ (game.state);

    for (const player of /** @type {any[]} */ (game.players)) {
      for (const slot of player.grid ?? []) {
        if (!slot.revealed) slot.value = null;
      }
    }

    if (Array.isArray(state.deck)) {
      state.deckCount = state.deck.length;
      delete state.deck;
    }
  }

  return game;
}

/**
 * @param {Party} party
 * @param {string | null} [viewerId]
 */
function publicParty(party, viewerId = null) {
  normalizeParty(party);

  return {
    code: party.code,
    createdAt: party.createdAt,
    locked: Boolean(party.locked),
    players: party.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      joinedAt: player.joinedAt,
      score: player.score,
      color: player.color,
      avatar: player.avatar
    })),
    availableGames: availableGames.map((game) => ({ ...game, settings: GAME_SETTINGS[game.id] ?? [] })),
    reactions: (party.reactions ?? []).filter((reaction) => Date.now() - reaction.at < REACTION_TTL_MS),
    history: (party.history ?? []).slice(-50),
    activeGame: party.activeGame ? redactActiveGame(structuredClone(party.activeGame), viewerId) : null
  };
}

/** @param {Party} party */
function notifyParty(party) {
  touchParty(party);
  const listeners = store.listeners.get(party.code);

  if (!listeners) return;

  // Each subscriber gets its own view, so private hands/boards stay private.
  for (const listener of listeners) {
    listener(party);
  }
}

/**
 * @param {Party} party
 * @param {unknown} token
 */
function viewerIdFor(party, token) {
  return resolvePlayer(party, token)?.id ?? null;
}

/**
 * @param {unknown} code
 * @param {(party: ReturnType<typeof publicParty>) => void} listener
 * @param {string | null} [token] identifies the viewer; private game state is redacted for everyone else
 */
export function subscribeParty(code, listener, token = null) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  touchParty(party);

  const listeners = store.listeners.get(cleanCode) ?? new Set();

  if (listeners.size >= MAX_LISTENERS_PER_PARTY) {
    return { status: 429, error: 'Zu viele gleichzeitige Verbindungen fuer diese Party.' };
  }

  /** @param {Party} rawParty */
  const viewerListener = (rawParty) => listener(publicParty(rawParty, viewerIdFor(rawParty, token)));
  listeners.add(viewerListener);
  store.listeners.set(cleanCode, listeners);
  viewerListener(party);

  return {
    unsubscribe: () => {
      listeners.delete(viewerListener);
      if (listeners.size === 0) {
        store.listeners.delete(cleanCode);
      }
    }
  };
}

/** @param {Party} party */
function getHost(party) {
  return party.players.find((player) => player.isHost) ?? null;
}

/** @param {ActiveGame} game */
function ensureGameMeta(game) {
  game.requests ??= { rematch: [], newGame: [] };
  game.scoreAwarded ??= false;
}

/** @param {Party} party */
function awardScoreIfNeeded(party) {
  if (!party.activeGame) return;

  ensureGameMeta(party.activeGame);

  if (party.activeGame.scoreAwarded || party.activeGame.status !== 'finished' || !party.activeGame.state.winnerId) {
    return;
  }

  const winner = party.players.find((player) => player.id === party.activeGame?.state.winnerId);

  if (winner) {
    winner.score += 1;
    party.activeGame.scoreAwarded = true;
  }
}

/** @param {unknown} name */
export function createParty(name, avatar = null) {
  const cleanName = normalizeName(name);

  if (!cleanName) {
    return { error: 'Bitte gib einen Namen ein.' };
  }

  if (store.parties.size >= MAX_PARTIES) {
    return { error: 'Es sind aktuell zu viele Partys aktiv. Bitte versuche es spaeter erneut.' };
  }

  const code = makeCode();
  const host = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name: cleanName,
    isHost: true,
    joinedAt: new Date().toISOString(),
    score: 0,
    color: playerColors[0],
    avatar: normalizeAvatar(avatar)
  };

  const party = {
    code,
    createdAt: new Date().toISOString(),
    players: [host],
    activeGame: null,
    locked: false,
    lastActivityAt: Date.now()
  };

  store.parties.set(code, party);

  return {
    party: publicParty(party, host.id),
    playerId: host.id,
    token: host.token
  };
}

/**
 * @param {unknown} code
 * @param {unknown} name
 */
export function joinParty(code, name, avatar = null) {
  const cleanCode = normalizeCode(code);
  const cleanName = normalizeName(name);

  if (!cleanCode) {
    return { status: 400, error: 'Bitte gib einen Party-Code ein.' };
  }

  if (!cleanName) {
    return { status: 400, error: 'Bitte gib einen Namen ein.' };
  }

  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  if (party.locked) {
    return { status: 423, error: 'Diese Party ist für neue Spieler gesperrt.' };
  }

  normalizeParty(party);

  const player = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name: cleanName,
    isHost: false,
    joinedAt: new Date().toISOString(),
    score: 0,
    color: playerColors.find((color) => !party.players.some((/** @type {Player} */ candidate) => candidate.color === color)) ?? playerColors[party.players.length % playerColors.length],
    avatar: normalizeAvatar(avatar)
  };

  party.players.push(player);
  notifyParty(party);

  return {
    party: publicParty(party, player.id),
    playerId: player.id,
    token: player.token
  };
}


/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} name
 */
export function renamePlayer(code, token, name) {
  const cleanCode = normalizeCode(code);
  const cleanName = normalizeName(name);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  if (!cleanName) {
    return { status: 400, error: 'Bitte gib einen Namen ein.' };
  }

  const player = resolvePlayer(party, token);
  if (!player) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  player.name = cleanName;
  if (party.activeGame) {
    const gamePlayer = party.activeGame.players.find((/** @type {{ id: string, name: string }} */ candidate) => candidate.id === player.id);
    if (gamePlayer) gamePlayer.name = cleanName;
  }

  notifyParty(party);
  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} color
 */
export function changePlayerColor(code, token, color) {
  const cleanCode = normalizeCode(code);
  const cleanColor = String(color ?? '').trim().toLowerCase();
  const party = store.parties.get(cleanCode);

  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  normalizeParty(party);
  const player = resolvePlayer(party, token);
  if (!player) return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  if (!playerColors.includes(cleanColor)) return { status: 400, error: 'Diese Spielerfarbe ist nicht verfügbar.' };
  if (party.players.some((/** @type {Player} */ candidate) => candidate.id !== player.id && candidate.color === cleanColor)) {
    return { status: 409, error: 'Diese Farbe ist bereits vergeben.' };
  }

  player.color = cleanColor;
  notifyParty(party);
  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} locked
 */
export function setPartyLocked(code, token, locked) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);
  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  const actor = resolvePlayer(party, token);
  if (!actor?.isHost) return { status: 403, error: 'Nur der Host kann die Party sperren.' };

  party.locked = Boolean(locked);
  notifyParty(party);
  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} targetPlayerId
 */
export function transferPartyHost(code, token, targetPlayerId) {
  const cleanCode = normalizeCode(code);
  const cleanTargetId = normalizePlayerId(targetPlayerId);
  const party = store.parties.get(cleanCode);
  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  const actor = resolvePlayer(party, token);
  if (!actor?.isHost) return { status: 403, error: 'Nur der Host kann die Host-Rolle übertragen.' };
  if (cleanTargetId === actor.id) return { status: 400, error: 'Du bist bereits der Host.' };

  const nextHost = party.players.find((/** @type {Player} */ player) => player.id === cleanTargetId);
  if (!nextHost) return { status: 404, error: 'Der ausgewählte Spieler wurde nicht gefunden.' };

  actor.isHost = false;
  nextHost.isHost = true;
  notifyParty(party);
  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} targetPlayerId
 */
export function removePartyPlayer(code, token, targetPlayerId) {
  const cleanCode = normalizeCode(code);
  const cleanTargetId = normalizePlayerId(targetPlayerId);
  const party = store.parties.get(cleanCode);
  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  const actor = resolvePlayer(party, token);
  if (!actor?.isHost) return { status: 403, error: 'Nur der Host kann Spieler entfernen.' };
  if (cleanTargetId === actor.id) return { status: 400, error: 'Der Host kann sich nicht selbst entfernen.' };
  if (party.activeGame) return { status: 409, error: 'Während eines laufenden Spiels können keine Spieler entfernt werden.' };

  const playerIndex = party.players.findIndex((/** @type {Player} */ player) => player.id === cleanTargetId);
  if (playerIndex < 0) return { status: 404, error: 'Der ausgewählte Spieler wurde nicht gefunden.' };

  party.players.splice(playerIndex, 1);
  notifyParty(party);
  return { party: publicParty(party, viewerIdFor(party, token)), removedPlayerId: cleanTargetId };
}
/** @param {unknown} code */
export function getParty(code) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return null;
  }

  touchParty(party);
  return publicParty(party);
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} gameId
 * @param {Record<string, unknown>} [settings]
 */
export function startGame(code, token, gameId, settings = {}, internalOptions = {}) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  normalizeParty(party);
  const actor = resolvePlayer(party, token);

  if (!actor?.isHost) {
    return { status: 403, error: 'Nur der Host kann ein Spiel starten.' };
  }

  const game = getGame(gameId);

  if (!game) {
    return { status: 400, error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  if (party.players.length < game.minPlayers) {
    return { status: 400, error: `${game.name} braucht mindestens ${game.minPlayers} Spieler.` };
  }

  // Nur bekannte Einstellungen mit gültigen Werten; interne Optionen (z. B. Startspieler) kommen nur vom Server.
  const sanitizedSettings = sanitizeGameSettings(game.id, settings);

  const session = createGameSession(game.id, party.players, { ...sanitizedSettings, ...internalOptions });

  if ('error' in session) {
    return { status: 400, error: session.error };
  }

  party.activeGame = {
    ...session,
    requests: { rematch: [], newGame: [] },
    scoreAwarded: false,
    settings: sanitizedSettings
  };
  notifyParty(party);

  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 */
export function restartGame(code, token) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  normalizeParty(party);
  const actor = resolvePlayer(party, token);

  if (!actor?.isHost) {
    return { status: 403, error: 'Nur der Host kann ein Spiel neu starten.' };
  }

  const gameId = party.activeGame?.gameId;

  if (!gameId) {
    return { status: 400, error: 'Es laeuft noch kein Spiel.' };
  }

  if (gameId === 'skyjo' && party.activeGame?.state.match?.enabled && !party.activeGame.state.match.matchFinished) {
    const previousSettings = party.activeGame.settings ?? {};
    const session = createGameSession(gameId, party.players, { ...previousSettings, previousMatch: party.activeGame.state.match });

    if ('error' in session) {
      return { status: 400, error: session.error };
    }

    party.activeGame = {
      ...session,
      requests: { rematch: [], newGame: [] },
      scoreAwarded: false,
      settings: previousSettings
    };
    notifyParty(party);

    return { party: publicParty(party, viewerIdFor(party, token)) };
  }

  // Bei Revanchen kann ein Spiel den Startspieler wechseln (z. B. Vier in einer Reihe).
  const previousStarterId = /** @type {any} */ (party.activeGame?.state)?.startPlayerId;
  return startGame(code, getHost(party)?.token, gameId, party.activeGame?.settings ?? {}, previousStarterId ? { previousStarterId } : {});
}

/**
 * @param {unknown} code
 * @param {unknown} token
 */
export function closeGame(code, token) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const actor = resolvePlayer(party, token);

  if (!actor?.isHost) {
    return { status: 403, error: 'Nur der Host kann zur Spielauswahl wechseln.' };
  }

  party.activeGame = null;
  notifyParty(party);

  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {'rematch' | 'newGame'} requestType
 */
export function requestGameEndAction(code, token, requestType) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const activeParty = /** @type {Party} */ (party);
  normalizeParty(activeParty);
  const actor = resolvePlayer(activeParty, token);

  if (!activeParty.activeGame || activeParty.activeGame.status !== 'finished') {
    return { status: 400, error: 'Das Spiel ist noch nicht beendet.' };
  }

  if (!actor) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  ensureGameMeta(activeParty.activeGame);
  const list = requestType === 'newGame' ? activeParty.activeGame.requests.newGame : activeParty.activeGame.requests.rematch;

  if (!list.includes(actor.id)) {
    list.push(actor.id);
  }

  notifyParty(party);

  return { party: publicParty(party, viewerIdFor(party, token)) };
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {{ cellIndex?: unknown }} move
 */
export function makeMove(code, token, move) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const activeParty = /** @type {Party} */ (party);
  normalizeParty(activeParty);
  const actor = resolvePlayer(activeParty, token);

  if (!activeParty.activeGame) {
    return { status: 400, error: 'Es laeuft noch kein Spiel.' };
  }

  if (!actor) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  const result = applyGameMove(activeParty.activeGame.gameId, activeParty.activeGame, actor.id, move);

  if ('error' in result && result.error) {
    return { status: 400, error: result.error };
  }

  awardScoreIfNeeded(activeParty);
  recordResultIfNeeded(activeParty);
  notifyParty(activeParty);

  return { party: publicParty(activeParty, actor.id) };
}

/**
 * Hält beendete Spiele für die Bestenliste der Party fest (einmal pro Spiel).
 * Bei Skyjo im 100-Punkte-Modus zählt erst das Ende der ganzen Partie.
 * @param {Party} party
 */
function recordResultIfNeeded(party) {
  const game = party.activeGame;
  if (!game || game.status !== 'finished' || game.resultRecorded) return;
  const match = game.state.match;
  if (match?.enabled && !match.matchFinished) return;

  const state = /** @type {Record<string, unknown>} */ (game.state);
  const winnerIds = Array.isArray(state.winnerIds) && state.winnerIds.length
    ? /** @type {string[]} */ (state.winnerIds)
    : Array.isArray(match?.winnerIds) && match.winnerIds.length
      ? match.winnerIds
      : game.state.winnerId
        ? [game.state.winnerId]
        : [];

  party.history ??= [];
  party.history.push({
    id: game.id,
    gameId: game.gameId,
    gameName: getGame(game.gameId)?.name ?? game.name,
    winnerIds,
    isDraw: Boolean(game.state.isDraw) || winnerIds.length === 0,
    playerIds: game.players.map((player) => player.id),
    finishedAt: new Date().toISOString()
  });
  if (party.history.length > 200) party.history.splice(0, party.history.length - 200);
  game.resultRecorded = true;
}

/**
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} avatar
 */
export function setPlayerAvatar(code, token, avatar) {
  const party = store.parties.get(normalizeCode(code));
  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  normalizeParty(party);
  const player = resolvePlayer(party, token);
  if (!player) return { status: 403, error: 'Dieses Gerät ist nicht in der Party angemeldet.' };

  player.avatar = normalizeAvatar(avatar, player.avatar);
  notifyParty(party);
  return { party: publicParty(party, player.id) };
}

/**
 * Kurze Emoji-Reaktion, die alle für ein paar Sekunden über dem Avatar sehen.
 * @param {unknown} code
 * @param {unknown} token
 * @param {unknown} emoji
 */
export function sendReaction(code, token, emoji) {
  const party = store.parties.get(normalizeCode(code));
  if (!party) return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  normalizeParty(party);
  const player = resolvePlayer(party, token);
  if (!player) return { status: 403, error: 'Dieses Gerät ist nicht in der Party angemeldet.' };

  const cleanEmoji = String(emoji ?? '');
  if (!REACTIONS.includes(cleanEmoji)) return { status: 400, error: 'Diese Reaktion gibt es nicht.' };

  const now = Date.now();
  if (player.lastReactionAt && now - player.lastReactionAt < 700) {
    return { status: 429, error: 'Nicht so schnell.' };
  }
  player.lastReactionAt = now;

  party.reactions = (party.reactions ?? []).filter((/** @type {Reaction} */ reaction) => now - reaction.at < REACTION_TTL_MS).slice(-30);
  party.reactions.push({ id: crypto.randomUUID(), playerId: player.id, emoji: cleanEmoji, at: now });
  notifyParty(party);
  return { ok: true };
}
