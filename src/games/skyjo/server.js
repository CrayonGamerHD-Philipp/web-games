/**
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {{ id: string, value: number }} SkyjoCard
 * @typedef {{ id: string, value: number | null, revealed: boolean, removed: boolean }} SkyjoSlot
 * @typedef {{ id: string, name: string, grid: SkyjoSlot[], roundScore: number }} SkyjoPlayer
 * @typedef {{ enabled: boolean, targetScore: number, round: number, totalScores: { playerId: string, score: number }[], lastRoundScores: { playerId: string, score: number }[], matchFinished: boolean, winnerIds: string[] }} SkyjoMatch
 * @typedef {{ phase: 'setup' | 'running' | 'final-turns' | 'finished', deck: SkyjoCard[], discardPile: SkyjoCard[], currentPlayerId: string | null, drawnCard: SkyjoCard | null, drawnFrom: 'deck' | 'discard' | null, winnerId: string | null, isDraw: boolean, finalTriggerPlayerId: string | null, remainingFinalPlayerIds: string[], roundScores: { playerId: string, score: number }[], match?: SkyjoMatch }} SkyjoState
 * @typedef {{ id: string, gameId: string, name: string, status: string, createdAt: string, players: SkyjoPlayer[], state: SkyjoState }} SkyjoSession
 * @typedef {{ playToHundred?: boolean, previousMatch?: SkyjoMatch | null }} SkyjoSessionOptions
 */

export const skyjoGame = {
  id: 'skyjo',
  name: 'Skyjo',
  description: 'Kartenspielrunde mit niedrigen Punkten, Ablage und finalen Zuegen.',
  previewImage: '/images/skyjo-scene.png',
  minPlayers: 2,
  maxPlayers: 8
};


/**
 * @param {BasicPlayer[]} players
 * @param {{ enabled?: boolean, targetScore?: number, round?: number, totalScores?: { playerId: string, score: number }[], lastRoundScores?: { playerId: string, score: number }[], matchFinished?: boolean, winnerIds?: string[] } | null | undefined} previousMatch
 */
function createMatch(players, previousMatch) {
  const enabled = Boolean(previousMatch?.enabled);
  return {
    enabled,
    targetScore: Number(previousMatch?.targetScore ?? 100),
    round: enabled ? Number(previousMatch?.round ?? 0) + 1 : 1,
    totalScores: players.map((player) => ({
      playerId: player.id,
      score: previousMatch?.totalScores?.find((entry) => entry.playerId === player.id)?.score ?? 0
    })),
    lastRoundScores: previousMatch?.lastRoundScores ?? [],
    matchFinished: false,
    winnerIds: []
  };
}

/**
 * @param {{ playerId: string, score: number }[]} scores
 */
function lowestScoreWinnerIds(scores) {
  const lowest = Math.min(...scores.map((score) => score.score));
  return scores.filter((score) => score.score === lowest).map((score) => score.playerId);
}
const cardDistribution = new Map([
  [-2, 5],
  [-1, 10],
  [0, 15],
  [1, 10],
  [2, 10],
  [3, 10],
  [4, 10],
  [5, 10],
  [6, 10],
  [7, 10],
  [8, 10],
  [9, 10],
  [10, 10],
  [11, 10],
  [12, 10]
]);

function createDeck() {
  /** @type {SkyjoCard[]} */
  const cards = [];

  for (const [value, amount] of cardDistribution) {
    for (let index = 0; index < amount; index += 1) {
      cards.push({ id: crypto.randomUUID(), value });
    }
  }

  return shuffle(cards);
}

/** @param {SkyjoCard[]} cards */
function shuffle(cards) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/** @param {SkyjoPlayer} player */
function visibleScore(player) {
  return player.grid.reduce((score, slot) => (slot.removed ? score : score + (slot.value ?? 0)), 0);
}

/** @param {SkyjoPlayer} player */
function isPlayerFullyRevealed(player) {
  return player.grid.every((slot) => slot.removed || slot.revealed);
}

/** @param {SkyjoSession} session */
function currentPlayer(session) {
  return session.players.find((player) => player.id === session.state.currentPlayerId) ?? null;
}

/**
 * @param {SkyjoSession} session
 * @param {string} playerId
 */
function advanceTurn(session, playerId) {
  if (session.state.phase === 'final-turns') {
    session.state.remainingFinalPlayerIds = session.state.remainingFinalPlayerIds.filter((id) => id !== playerId);

    if (session.state.remainingFinalPlayerIds.length === 0) {
      finishGame(session);
      return;
    }

    session.state.currentPlayerId = session.state.remainingFinalPlayerIds[0];
    return;
  }

  const player = session.players.find((candidate) => candidate.id === playerId);

  if (player && isPlayerFullyRevealed(player)) {
    session.state.phase = 'final-turns';
    session.state.finalTriggerPlayerId = player.id;
    session.state.remainingFinalPlayerIds = session.players
      .filter((candidate) => candidate.id !== player.id)
      .map((candidate) => candidate.id);

    if (session.state.remainingFinalPlayerIds.length === 0) {
      finishGame(session);
      return;
    }

    session.state.currentPlayerId = session.state.remainingFinalPlayerIds[0];
    return;
  }

  const currentIndex = session.players.findIndex((candidate) => candidate.id === playerId);
  const nextIndex = (currentIndex + 1) % session.players.length;
  session.state.currentPlayerId = session.players[nextIndex]?.id ?? session.players[0]?.id ?? null;
}

/** @param {SkyjoSession} session */
function maybeStartRunningPhase(session) {
  if (session.state.phase !== 'setup') return;

  const allReady = session.players.every((player) => player.grid.filter((slot) => slot.revealed).length >= 2);

  if (!allReady) return;

  session.state.phase = 'running';
  session.state.currentPlayerId = session.players[0]?.id ?? null;
}

/** @param {SkyjoSession} session */
function recycleDiscardIntoDeck(session) {
  if (session.state.deck.length > 0 || session.state.discardPile.length <= 1) return;

  const top = session.state.discardPile.at(-1);
  const rest = session.state.discardPile.slice(0, -1);
  session.state.deck = shuffle(rest);
  session.state.discardPile = top ? [top] : [];
}

const lineGroups = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [0, 4, 8],
  [1, 5, 9],
  [2, 6, 10],
  [3, 7, 11]
];

/**
 * @param {SkyjoSession} session
 * @param {SkyjoPlayer} player
 */
function clearMatchingLines(session, player) {
  let clearedLine = true;

  while (clearedLine) {
    clearedLine = false;

    for (const indexes of lineGroups) {
      const activeIndexes = indexes.filter((index) => !player.grid[index]?.removed);
      const slots = activeIndexes.map((index) => player.grid[index]);

      if (slots.length < 2) continue;
      if (!slots.every((slot) => slot && slot.revealed && slot.value === slots[0].value)) continue;

      for (const index of activeIndexes) {
        const slot = player.grid[index];
        if (slot.value !== null) {
          session.state.discardPile.push({ id: slot.id, value: slot.value });
        }
        slot.removed = true;
      }

      clearedLine = true;
    }
  }
}

/** @param {SkyjoSession} session */
function finishGame(session) {
  for (const player of session.players) {
    for (const slot of player.grid) {
      if (!slot.removed) {
        slot.revealed = true;
      }
    }
  }

  const rawScores = session.players.map((player) => ({ playerId: player.id, score: visibleScore(player) }));
  const triggerScore = rawScores.find((score) => score.playerId === session.state.finalTriggerPlayerId);

  if (triggerScore && rawScores.some((score) => score.playerId !== triggerScore.playerId && score.score <= triggerScore.score)) {
    triggerScore.score *= 2;
  }

  session.state.roundScores = rawScores;
  session.state.currentPlayerId = null;
  session.state.drawnCard = null;
  session.state.drawnFrom = null;
  session.state.phase = 'finished';
  session.status = 'finished';

  if (session.state.match?.enabled) {
    const match = session.state.match;
    match.lastRoundScores = rawScores;
    match.totalScores = match.totalScores.map((total) => ({
      ...total,
      score: total.score + (rawScores.find((round) => round.playerId === total.playerId)?.score ?? 0)
    }));

    const reachedTarget = match.totalScores.some((score) => score.score >= match.targetScore);
    if (reachedTarget) {
      match.matchFinished = true;
      match.winnerIds = lowestScoreWinnerIds(match.totalScores);
      session.state.winnerId = match.winnerIds.length === 1 ? match.winnerIds[0] : null;
      session.state.isDraw = match.winnerIds.length !== 1;
      return;
    }

    match.matchFinished = false;
    match.winnerIds = [];
    session.state.winnerId = null;
    session.state.isDraw = false;
    return;
  }

  const roundWinnerIds = lowestScoreWinnerIds(rawScores);
  session.state.winnerId = roundWinnerIds.length === 1 ? roundWinnerIds[0] : null;
  session.state.isDraw = roundWinnerIds.length !== 1;
}

/**
 * @param {BasicPlayer[]} players
 * @returns {SkyjoSession | { error: string }}
 */
export function createSkyjoSession(players, options = /** @type {SkyjoSessionOptions} */ ({})) {
  const selectedPlayers = players.slice(0, skyjoGame.maxPlayers);

  if (selectedPlayers.length < skyjoGame.minPlayers) {
    return { error: 'Skyjo braucht mindestens zwei Spieler.' };
  }

  const deck = createDeck();
  /** @type {SkyjoPlayer[]} */
  const skyjoPlayers = selectedPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    roundScore: 0,
    grid: Array.from({ length: 12 }, () => {
      const card = deck.pop();

      if (!card) {
        throw new Error('Skyjo-Deck enthaelt zu wenige Karten.');
      }

      return {
        id: card.id,
        value: card.value,
        revealed: false,
        removed: false
      };
    })
  }));

  const firstDiscard = deck.pop();

  if (!firstDiscard) {
    return { error: 'Skyjo konnte nicht vorbereitet werden.' };
  }

  return {
    id: crypto.randomUUID(),
    gameId: skyjoGame.id,
    name: skyjoGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: skyjoPlayers,
    state: {
      phase: 'setup',
      deck,
      discardPile: [firstDiscard],
      currentPlayerId: null,
      drawnCard: null,
      drawnFrom: null,
      winnerId: null,
      isDraw: false,
      finalTriggerPlayerId: null,
      remainingFinalPlayerIds: [],
      roundScores: [],
      match: createMatch(selectedPlayers, options.previousMatch ?? (options.playToHundred ? { enabled: true, targetScore: 100, round: 0, totalScores: [] } : null))
    }
  };
}

/**
 * @param {SkyjoSession} session
 * @param {string} playerId
 * @param {{ type?: unknown, cardIndex?: unknown, source?: unknown }} move
 */
export function makeSkyjoMove(session, playerId, move) {
  if (session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }

  const player = session.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return { error: 'Du schaust diese Skyjo-Runde nur zu.' };
  }

  const type = String(move.type ?? '');
  const index = Number(move.cardIndex);

  if (type === 'reveal-start') {
    if (session.state.phase !== 'setup') {
      return { error: 'Die Startkarten wurden bereits aufgedeckt.' };
    }

    if (!Number.isInteger(index) || index < 0 || index >= player.grid.length) {
      return { error: 'Diese Karte ist ungueltig.' };
    }

    if (player.grid.filter((slot) => slot.revealed).length >= 2) {
      return { error: 'Du hast bereits zwei Startkarten aufgedeckt.' };
    }

    player.grid[index].revealed = true;
    maybeStartRunningPhase(session);
    return { session };
  }

  if (session.state.phase !== 'running' && session.state.phase !== 'final-turns') {
    return { error: 'Diese Aktion ist jetzt noch nicht moeglich.' };
  }

  if (session.state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }

  if (type === 'draw') {
    if (session.state.drawnCard) {
      return { error: 'Du hast bereits eine Karte gezogen.' };
    }

    const source = String(move.source ?? 'deck');

    if (source === 'discard') {
      const card = session.state.discardPile.pop();

      if (!card) {
        return { error: 'Der Ablagestapel ist leer.' };
      }

      session.state.drawnCard = card;
      session.state.drawnFrom = 'discard';
      return { session };
    }

    recycleDiscardIntoDeck(session);
    const card = session.state.deck.pop();

    if (!card) {
      return { error: 'Der Nachziehstapel ist leer.' };
    }

    session.state.drawnCard = card;
    session.state.drawnFrom = 'deck';
    return { session };
  }

  if (type === 'replace') {
    if (!session.state.drawnCard) {
      return { error: 'Du musst zuerst eine Karte ziehen.' };
    }

    if (!Number.isInteger(index) || index < 0 || index >= player.grid.length) {
      return { error: 'Diese Karte ist ungueltig.' };
    }

    const slot = player.grid[index];

    if (slot.removed) {
      return { error: 'Diese Spalte ist bereits abgeraeumt.' };
    }

    if (slot.value !== null) {
      session.state.discardPile.push({ id: slot.id, value: slot.value });
    }

    slot.id = session.state.drawnCard.id;
    slot.value = session.state.drawnCard.value;
    slot.revealed = true;
    session.state.drawnCard = null;
    session.state.drawnFrom = null;
    clearMatchingLines(session, player);
    advanceTurn(session, playerId);
    return { session };
  }

  if (type === 'replace-from-discard') {
    if (session.state.drawnCard) {
      return { error: 'Du hast bereits eine Karte gezogen.' };
    }

    if (!Number.isInteger(index) || index < 0 || index >= player.grid.length) {
      return { error: 'Diese Karte ist ungueltig.' };
    }

    const slot = player.grid[index];

    if (slot.removed) {
      return { error: 'Diese Spalte ist bereits abgeraeumt.' };
    }

    const discardCard = session.state.discardPile.pop();

    if (!discardCard) {
      return { error: 'Der Ablagestapel ist leer.' };
    }

    if (slot.value !== null) {
      session.state.discardPile.push({ id: slot.id, value: slot.value });
    }

    slot.id = discardCard.id;
    slot.value = discardCard.value;
    slot.revealed = true;
    clearMatchingLines(session, player);
    advanceTurn(session, playerId);
    return { session };
  }
  if (type === 'discard-and-reveal') {
    if (!session.state.drawnCard || session.state.drawnFrom !== 'deck') {
      return { error: 'Nur eine verdeckt gezogene Karte darf abgelegt werden.' };
    }

    if (!Number.isInteger(index) || index < 0 || index >= player.grid.length) {
      return { error: 'Diese Karte ist ungueltig.' };
    }

    const slot = player.grid[index];

    if (slot.removed || slot.revealed) {
      return { error: 'Du musst eine verdeckte Karte aufdecken.' };
    }

    session.state.discardPile.push(session.state.drawnCard);
    session.state.drawnCard = null;
    session.state.drawnFrom = null;
    slot.revealed = true;
    clearMatchingLines(session, player);
    advanceTurn(session, playerId);
    return { session };
  }

  return { error: 'Diese Skyjo-Aktion ist nicht bekannt.' };
}

