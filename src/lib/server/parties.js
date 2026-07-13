import { applyGameMove, availableGames, createGameSession, getGame } from './games/index.js';

/**
 * @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number }} Player
 * @typedef {{ enabled?: boolean, targetScore?: number, round?: number, totalScores?: { playerId: string, score: number }[], lastRoundScores?: { playerId: string, score: number }[], matchFinished?: boolean, winnerIds?: string[] }} SkyjoMatch
 * @typedef {{ id: string, gameId: string, name: string, status: string, createdAt: string, players: { id: string, name: string, mark?: string }[], state: { currentPlayerId: string | null, winnerId: string | null, isDraw: boolean, roundScores?: { playerId: string, score: number }[], match?: SkyjoMatch, [key: string]: unknown }, requests: { rematch: string[], newGame: string[] }, scoreAwarded: boolean }} ActiveGame
 * @typedef {{ code: string, createdAt: string, players: Player[], activeGame: ActiveGame | null }} Party
 * @typedef {{ parties: Map<string, Party>, listeners: Map<string, Set<(party: ReturnType<typeof publicParty>) => void>> }} Store
 */

function createStore() {
  /** @type {Store} */
  return {
    parties: new Map(),
    listeners: new Map()
  };
}

const globalStore = /** @type {typeof globalThis & { __web_games_party_store__?: Store }} */ (globalThis);
const store = globalStore.__web_games_party_store__ ?? createStore();
store.listeners ??= new Map();
globalStore.__web_games_party_store__ = store;

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
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (store.parties.has(code));

  return code;
}

/** @param {Party} party */
function normalizeParty(party) {
  party.players = party.players.map((player) => ({
    ...player,
    score: Number.isFinite(player.score) ? player.score : 0
  }));

  if (party.activeGame) {
    party.activeGame.requests ??= { rematch: [], newGame: [] };
    party.activeGame.scoreAwarded ??= false;
  }
}

/** @param {Party} party */
function publicParty(party) {
  normalizeParty(party);

  return {
    code: party.code,
    createdAt: party.createdAt,
    players: party.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      joinedAt: player.joinedAt,
      score: player.score
    })),
    availableGames: availableGames.map((game) => ({ ...game })),
    activeGame: party.activeGame ? structuredClone(party.activeGame) : null
  };
}

/** @param {Party} party */
function notifyParty(party) {
  const publicData = publicParty(party);
  const listeners = store.listeners.get(party.code);

  if (!listeners) return;

  for (const listener of listeners) {
    listener(publicData);
  }
}

/**
 * @param {unknown} code
 * @param {(party: ReturnType<typeof publicParty>) => void} listener
 */
export function subscribeParty(code, listener) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const listeners = store.listeners.get(cleanCode) ?? new Set();
  listeners.add(listener);
  store.listeners.set(cleanCode, listeners);
  listener(publicParty(party));

  return {
    unsubscribe: () => {
      listeners.delete(listener);
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

/**
 * @param {Party} party
 * @param {unknown} playerId
 */
function isHost(party, playerId) {
  const cleanPlayerId = normalizePlayerId(playerId);
  return party.players.some((player) => player.id === cleanPlayerId && player.isHost);
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
export function createParty(name) {
  const cleanName = normalizeName(name);

  if (!cleanName) {
    return { error: 'Bitte gib einen Namen ein.' };
  }

  const code = makeCode();
  const host = {
    id: crypto.randomUUID(),
    name: cleanName,
    isHost: true,
    joinedAt: new Date().toISOString(),
    score: 0
  };

  const party = {
    code,
    createdAt: new Date().toISOString(),
    players: [host],
    activeGame: null
  };

  store.parties.set(code, party);

  return {
    party: publicParty(party),
    playerId: host.id
  };
}

/**
 * @param {unknown} code
 * @param {unknown} name
 */
export function joinParty(code, name) {
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

  normalizeParty(party);

  const player = {
    id: crypto.randomUUID(),
    name: cleanName,
    isHost: false,
    joinedAt: new Date().toISOString(),
    score: 0
  };

  party.players.push(player);
  notifyParty(party);

  return {
    party: publicParty(party),
    playerId: player.id
  };
}


/**
 * @param {unknown} code
 * @param {unknown} playerId
 * @param {unknown} name
 */
export function renamePlayer(code, playerId, name) {
  const cleanCode = normalizeCode(code);
  const cleanPlayerId = normalizePlayerId(playerId);
  const cleanName = normalizeName(name);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  if (!cleanName) {
    return { status: 400, error: 'Bitte gib einen Namen ein.' };
  }

  const player = party.players.find((/** @type {Player} */ candidate) => candidate.id === cleanPlayerId);
  if (!player) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  player.name = cleanName;
  if (party.activeGame) {
    const gamePlayer = party.activeGame.players.find((/** @type {{ id: string, name: string }} */ candidate) => candidate.id === cleanPlayerId);
    if (gamePlayer) gamePlayer.name = cleanName;
  }

  notifyParty(party);
  return { party: publicParty(party) };
}
/** @param {unknown} code */
export function getParty(code) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return null;
  }

  return publicParty(party);
}

/**
 * @param {unknown} code
 * @param {unknown} playerId
 * @param {unknown} gameId
 */
export function startGame(code, playerId, gameId, settings = {}) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  normalizeParty(party);

  if (!isHost(party, playerId)) {
    return { status: 403, error: 'Nur der Host kann ein Spiel starten.' };
  }

  const game = getGame(gameId);

  if (!game) {
    return { status: 400, error: 'Dieses Spiel ist nicht verfuegbar.' };
  }

  if (party.players.length < game.minPlayers) {
    return { status: 400, error: `${game.name} braucht mindestens ${game.minPlayers} Spieler.` };
  }

  const session = createGameSession(game.id, party.players, settings);

  if ('error' in session) {
    return { status: 400, error: session.error };
  }

  party.activeGame = {
    ...session,
    requests: { rematch: [], newGame: [] },
    scoreAwarded: false
  };
  notifyParty(party);

  return { party: publicParty(party) };
}

/**
 * @param {unknown} code
 * @param {unknown} playerId
 */
export function restartGame(code, playerId) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  normalizeParty(party);

  if (!isHost(party, playerId)) {
    return { status: 403, error: 'Nur der Host kann ein Spiel neu starten.' };
  }

  const gameId = party.activeGame?.gameId;

  if (!gameId) {
    return { status: 400, error: 'Es laeuft noch kein Spiel.' };
  }

  if (gameId === 'skyjo' && party.activeGame?.state.match?.enabled && !party.activeGame.state.match.matchFinished) {
    const session = createGameSession(gameId, party.players, { previousMatch: party.activeGame.state.match });

    if ('error' in session) {
      return { status: 400, error: session.error };
    }

    party.activeGame = {
      ...session,
      requests: { rematch: [], newGame: [] },
      scoreAwarded: false
    };
    notifyParty(party);

    return { party: publicParty(party) };
  }

  return startGame(code, getHost(party)?.id, gameId);
}

/**
 * @param {unknown} code
 * @param {unknown} playerId
 */
export function closeGame(code, playerId) {
  const cleanCode = normalizeCode(code);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  if (!isHost(party, playerId)) {
    return { status: 403, error: 'Nur der Host kann zur Spielauswahl wechseln.' };
  }

  party.activeGame = null;
  notifyParty(party);

  return { party: publicParty(party) };
}

/**
 * @param {unknown} code
 * @param {unknown} playerId
 * @param {'rematch' | 'newGame'} requestType
 */
export function requestGameEndAction(code, playerId, requestType) {
  const cleanCode = normalizeCode(code);
  const cleanPlayerId = normalizePlayerId(playerId);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const activeParty = /** @type {Party} */ (party);
  normalizeParty(activeParty);

  if (!activeParty.activeGame || activeParty.activeGame.status !== 'finished') {
    return { status: 400, error: 'Das Spiel ist noch nicht beendet.' };
  }

  if (!activeParty.players.some((/** @type {Player} */ player) => player.id === cleanPlayerId)) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  ensureGameMeta(activeParty.activeGame);
  const list = requestType === 'newGame' ? activeParty.activeGame.requests.newGame : activeParty.activeGame.requests.rematch;

  if (!list.includes(cleanPlayerId)) {
    list.push(cleanPlayerId);
  }

  notifyParty(party);

  return { party: publicParty(party) };
}

/**
 * @param {unknown} code
 * @param {unknown} playerId
 * @param {{ cellIndex?: unknown }} move
 */
export function makeMove(code, playerId, move) {
  const cleanCode = normalizeCode(code);
  const cleanPlayerId = normalizePlayerId(playerId);
  const party = store.parties.get(cleanCode);

  if (!party) {
    return { status: 404, error: 'Diese Party wurde nicht gefunden.' };
  }

  const activeParty = /** @type {Party} */ (party);
  normalizeParty(activeParty);

  if (!activeParty.activeGame) {
    return { status: 400, error: 'Es laeuft noch kein Spiel.' };
  }

  if (!activeParty.players.some((/** @type {Player} */ player) => player.id === cleanPlayerId)) {
    return { status: 403, error: 'Dieses Geraet ist nicht in der Party angemeldet.' };
  }

  const result = applyGameMove(activeParty.activeGame.gameId, activeParty.activeGame, cleanPlayerId, move);

  if ('error' in result && result.error) {
    return { status: 400, error: result.error };
  }

  awardScoreIfNeeded(activeParty);
  notifyParty(activeParty);

  return { party: publicParty(activeParty) };
}




