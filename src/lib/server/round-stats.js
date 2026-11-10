/**
 * Zählt während einer Runde mit und baut am Ende den Statistik-Eintrag.
 * Die Spiele selbst müssen dafür nichts wissen: gezählt werden Züge (Wechsel des aktiven Spielers),
 * Zugarten (`move.type`) und Spielereignisse (`state.lastEvent`). Der Rest wird aus dem Endstand gelesen.
 *
 * @typedef {import('../round-stats.js').RoundRecord} RoundRecord
 * @typedef {Record<string, Record<string, number>>} Counter
 * @typedef {{ startedAt: string, turns: Record<string, number>, moves: Counter, events: Counter, lastEventSeq: number }} RoundTracking
 */

/** @param {Record<string, any>} session */
export function createTracking(session) {
  /** @type {RoundTracking} */
  return {
    startedAt: new Date().toISOString(),
    turns: {},
    moves: {},
    events: {},
    lastEventSeq: Number(session?.state?.lastEvent?.seq ?? 0)
  };
}

/**
 * @param {Counter} counter
 * @param {string} playerId
 * @param {string} key
 */
function bump(counter, playerId, key) {
  counter[playerId] ??= {};
  counter[playerId][key] = (counter[playerId][key] ?? 0) + 1;
}

/**
 * Nach einem erfolgreichen Zug aufrufen.
 * @param {RoundTracking} tracking
 * @param {Record<string, any>} session
 * @param {string} playerId
 * @param {Record<string, unknown>} move
 * @param {string | null} previousTurnPlayerId
 */
export function trackMove(tracking, session, playerId, move, previousTurnPlayerId) {
  const type = typeof move?.type === 'string' ? move.type : 'move';
  bump(tracking.moves, playerId, type);
  if (typeof move?.source === 'string') bump(tracking.moves, playerId, `${type}:${move.source}`);

  // Ein Zug endet, wenn der Spieler abgibt – oder mit dem letzten Zug der Runde.
  if (previousTurnPlayerId === playerId && (session.state?.currentPlayerId !== playerId || session.status === 'finished')) {
    tracking.turns[playerId] = (tracking.turns[playerId] ?? 0) + 1;
  }

  const event = session.state?.lastEvent;
  const seq = Number(event?.seq ?? 0);
  if (event && seq !== tracking.lastEventSeq) {
    tracking.lastEventSeq = seq;
    if (event.playerId) bump(tracking.events, event.playerId, String(event.type));
    if (event.capturedPlayerId) bump(tracking.events, event.capturedPlayerId, 'wasCaptured');
  }
}

/**
 * @param {Counter} counter
 * @param {string} playerId
 * @param {string} key
 */
function count(counter, playerId, key) {
  return counter[playerId]?.[key] ?? 0;
}

/** Spielspezifische Werte je Spieler aus Endstand + Zählern. */
const deriveStats = {
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  'auf-und-ab'(session, t, player) {
    const stats = player.stats ?? {};
    return {
      cardsPlayed: stats.played ?? 0,
      fromStock: stats.fromStock ?? 0,
      pilesCompleted: stats.completed ?? 0,
      jokers: stats.jokers ?? 0,
      discards: count(t.moves, player.id, 'discard'),
      stockLeft: player.stockCount ?? player.stock?.length ?? 0
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  moosgeister(session, t, player) {
    /** @type {{ scores?: { playerId: string, breakdown: import('../../games/moosgeister/rules.js').MoosScore }[] }[]} */
    const results = session.state?.results ?? [];
    const mine = results
      .map((result) => result.scores?.find((score) => score.playerId === player.id)?.breakdown)
      .filter((score) => score !== undefined);
    /** @type {{ moss: unknown }[]} */
    const layout = player.layout ?? [];
    return {
      totalPoints: mine.reduce((sum, score) => sum + score.total, 0),
      bestDurchgang: mine.length ? Math.max(...mine.map((score) => score.total)) : 0,
      biggestGroup: mine.length ? Math.max(...mine.map((score) => score.groupSize)) : 0,
      numberPoints: mine.reduce((sum, score) => sum + score.numbers, 0),
      mossCards: layout.filter((slot) => slot.moss).length,
      cardsTaken: count(t.moves, player.id, 'take')
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player @param {Record<string, unknown>} settings */
  kunterbunt(session, t, player, settings) {
    const handSize = [5, 7, 10].includes(Number(settings?.handSize)) ? Number(settings.handSize) : 7;
    const played = count(t.moves, player.id, 'play');
    const left = player.hand?.length ?? player.handCount ?? 0;
    return {
      cardsPlayed: played,
      cardsDrawn: Math.max(0, left + played - handSize),
      actionCards: ['skip', 'reverse', 'stack', 'wish'].reduce((sum, key) => sum + count(t.events, player.id, key), 0),
      buntCalls: count(t.events, player.id, 'bunt'),
      buntForgotten: count(t.events, player.id, 'bunt-penalty'),
      cardsLeft: left
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  skyjo(session, t, player) {
    const draws = count(t.moves, player.id, 'draw');
    const fromDiscard = count(t.moves, player.id, 'draw:discard');
    return {
      roundPoints: session.state.roundScores?.find((/** @type {any} */ score) => score.playerId === player.id)?.score ?? 0,
      drawnFromDeck: draws - fromDiscard,
      takenFromDiscard: fromDiscard + count(t.moves, player.id, 'replace-from-discard'),
      cardsCleared: (player.grid ?? []).filter((/** @type {any} */ slot) => slot.removed).length
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  'schiffe-versenken'(session, t, player) {
    const target = session.players.find((/** @type {any} */ candidate) => candidate.id !== player.id);
    const shots = target?.incoming ?? [];
    const hits = shots.filter((/** @type {any} */ shot) => shot.result === 'hit').length;
    return {
      shots: shots.length,
      hits,
      accuracy: shots.length ? (hits / shots.length) * 100 : 0,
      shipsSunk: (target?.ships ?? []).filter((/** @type {any} */ ship) => ship.sunk).length
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  wuerfelblock(session, t, player) {
    return {
      points: player.total ?? 0,
      rolls: count(t.moves, player.id, 'roll'),
      strikes: count(t.events, player.id, 'strike')
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  'noch-mal'(session, t, player) {
    return {
      points: player.score?.total ?? 0,
      crosses: player.checkedCells?.length ?? 0,
      jokers: player.usedJokers ?? 0,
      skipped: count(t.moves, player.id, 'skip-turn')
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  'ab-nach-hause'(session, t, player) {
    return {
      rolls: count(t.moves, player.id, 'roll'),
      piecesHome: player.homeCount ?? 0,
      captures: count(t.events, player.id, 'capture'),
      wasCaptured: count(t.events, player.id, 'wasCaptured')
    };
  },
  /** @param {any} session @param {RoundTracking} t @param {any} player */
  'sudoku-duell'(session, t, player) {
    return {
      solved: (player.entries ?? []).filter(Boolean).length,
      mistakes: player.mistakes ?? 0
    };
  }
};

/**
 * Baut den Statistik-Eintrag einer beendeten Runde.
 * @param {Record<string, any>} game aktives Spiel (ungeschwärzt)
 * @param {RoundTracking} tracking
 * @param {string} gameName
 * @param {string[]} winnerIds
 * @returns {RoundRecord}
 */
export function buildRoundRecord(game, tracking, gameName, winnerIds) {
  const finishedAt = new Date();
  const startedAt = tracking?.startedAt ?? game.createdAt ?? finishedAt.toISOString();
  const derive = /** @type {Record<string, (session: any, t: RoundTracking, player: any, settings: Record<string, unknown>) => Record<string, number>>} */ (deriveStats)[game.gameId];
  const safeTracking = tracking ?? createTracking(game);

  return {
    id: `${game.id}:${game.state?.match?.round ?? 1}`,
    gameId: game.gameId,
    gameName,
    round: game.state?.match?.enabled ? Number(game.state.match.round ?? 1) : null,
    startedAt,
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - new Date(startedAt).getTime()),
    winnerIds,
    isDraw: Boolean(game.state?.isDraw) || winnerIds.length === 0,
    players: game.players.map((/** @type {any} */ player) => ({
      id: player.id,
      name: player.name,
      stats: {
        turns: safeTracking.turns[player.id] ?? 0,
        ...(derive ? derive(game, safeTracking, player, game.settings ?? {}) : {})
      }
    }))
  };
}
