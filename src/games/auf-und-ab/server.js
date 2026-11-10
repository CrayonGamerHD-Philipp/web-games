/**
 * Auf & Ab – Ablegespiel für 2–6 Personen: Vorratsstapel leer spielen, über zwei Aufwärts-
 * und zwei Abwärtsstapel in der Mitte.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./rules.js').AufCard} AufCard
 * @typedef {import('./rules.js').AufBuildPile} AufBuildPile
 * @typedef {{ played: number, fromStock: number, jokers: number, completed: number }} AufPlayerStats
 * @typedef {{
 *   id: string, name: string,
 *   hand: AufCard[], handCount: number,
 *   stock: AufCard[], stockCount: number,
 *   discards: AufCard[][],
 *   stats: AufPlayerStats
 * }} AufPlayer
 * @typedef {'start' | 'play' | 'complete' | 'refill' | 'discard' | 'end-turn' | 'win'} AufEventType
 * @typedef {{ seq: number, type: AufEventType, playerId: string | null, card?: AufCard, value?: number, pileId?: string, source?: string, text: string }} AufEvent
 * @typedef {{
 *   currentPlayerId: string | null,
 *   turnOrder: string[],
 *   startPlayerId: string | null,
 *   stockSize: number,
 *   deck: AufCard[],
 *   deckCount: number,
 *   buildPiles: AufBuildPile[],
 *   completedPiles: number,
 *   reshuffles: number,
 *   idleTurns: number,
 *   builtThisTurn: boolean,
 *   turnNumber: number,
 *   winnerId: string | null,
 *   winnerIds: string[],
 *   isDraw: boolean,
 *   moveCount: number,
 *   lastEvent: AufEvent | null
 * }} AufState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: AufPlayer[], state: AufState }} AufSession
 * @typedef {{ type?: unknown, source?: unknown, cardId?: unknown, discardIndex?: unknown, pileId?: unknown }} AufMove
 */

import { BUILD_PILES, DISCARD_PILES, HAND_SIZE, canPlay, cardName, createDeck, emptyBuildPiles, isJoker, isPileDone, nextValue } from './rules.js';

export const aufUndAbGame = {
  id: 'auf-und-ab',
  name: 'Auf & Ab',
  description: 'Spiel deinen Vorratsstapel leer – auf zwei Stapel von 1 bis 12 hoch und auf zwei von 12 bis 1 runter. Joker passen immer.',
  previewImage: '/images/auf-und-ab-scene.webp',
  minPlayers: 2,
  maxPlayers: 6
};

/**
 * @template T
 * @param {T[]} items
 */
function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** @param {AufSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/**
 * @param {AufSession} session
 * @param {Omit<AufEvent, 'seq'>} event
 */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/** @param {AufPlayer} player */
function syncCounts(player) {
  player.handCount = player.hand.length;
  player.stockCount = player.stock.length;
}

/**
 * Leerer Nachziehstapel: Alle Baustapel bis auf ihre oberste Karte werden neu gemischt.
 * @param {AufSession} session
 */
function reclaimBuildPiles(session) {
  const { state } = session;
  /** @type {AufCard[]} */
  const reclaimed = [];
  for (const pile of state.buildPiles) {
    if (pile.cards.length > 1) reclaimed.push(...pile.cards.splice(0, pile.cards.length - 1).map((entry) => entry.card));
  }
  if (reclaimed.length) {
    state.deck.unshift(...shuffle(reclaimed));
    state.reshuffles += 1;
  }
  return reclaimed.length;
}

/** @param {AufSession} session @param {AufPlayer} player */
function refillHand(session, player) {
  const { state } = session;
  while (player.hand.length < HAND_SIZE) {
    if (!state.deck.length && !reclaimBuildPiles(session)) break;
    player.hand.push(/** @type {AufCard} */ (state.deck.pop()));
  }
  state.deckCount = state.deck.length;
  syncCounts(player);
}

/** @param {AufSession} session @param {string} playerId */
function playerAfter(session, playerId) {
  const order = session.state.turnOrder;
  return order[(order.indexOf(playerId) + 1) % order.length];
}

/**
 * Notbremse: Stapel leer und eine ganze Runde lang hat niemand gebaut – wer am wenigsten
 * Vorrat hat, gewinnt.
 * @param {AufSession} session
 */
function checkDeadlock(session) {
  const { state } = session;
  if (state.deck.length || state.idleTurns < session.players.length) return false;
  const fewest = Math.min(...session.players.map((player) => player.stock.length));
  const winnerIds = session.players.filter((player) => player.stock.length === fewest).map((player) => player.id);
  session.status = 'finished';
  state.currentPlayerId = null;
  state.winnerIds = winnerIds;
  state.winnerId = winnerIds.length === 1 ? winnerIds[0] : null;
  state.isDraw = winnerIds.length !== 1;
  setEvent(session, {
    type: 'win',
    playerId: state.winnerId,
    text: `Nichts geht mehr – keine Karte passt und der Stapel ist leer. ${winnerIds.map((id) => nameOf(session, id)).join(', ')} ${winnerIds.length === 1 ? 'hat' : 'haben'} den kleinsten Vorrat (${fewest}).`
  });
  return true;
}

/** @param {AufSession} session @param {string} playerId */
function startTurn(session, playerId) {
  if (checkDeadlock(session)) return;
  const player = /** @type {AufPlayer} */ (session.players.find((candidate) => candidate.id === playerId));
  const { state } = session;
  state.idleTurns = state.builtThisTurn ? 0 : state.idleTurns + 1;
  state.builtThisTurn = false;
  state.currentPlayerId = playerId;
  state.turnNumber += 1;
  refillHand(session, player);
}

/**
 * Stock size: 10, 20 or 30 cards. With 5+ players there are not enough cards for 30.
 * @param {unknown} raw
 * @param {number} playerCount
 */
export function resolveStockSize(raw, playerCount) {
  const wanted = [10, 20, 30].includes(Number(raw)) ? Number(raw) : 30;
  return playerCount >= 5 ? Math.min(wanted, 20) : wanted;
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {AufSession | { error: string }}
 */
export function createAufUndAbSession(players, options = {}) {
  const selected = (Array.isArray(players) ? players : []).slice(0, aufUndAbGame.maxPlayers);
  if (selected.length < aufUndAbGame.minPlayers) {
    return { error: 'Auf & Ab braucht mindestens zwei Spieler.' };
  }
  const stockSize = resolveStockSize(options.stockSize, selected.length);
  const deck = shuffle(createDeck());
  const turnOrder = selected.map((player) => player.id);
  const previous = typeof options.previousStarterId === 'string' ? turnOrder.indexOf(options.previousStarterId) : -1;
  const startPlayerId = previous >= 0 ? turnOrder[(previous + 1) % turnOrder.length] : turnOrder[Math.floor(Math.random() * turnOrder.length)];

  /** @type {AufSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: aufUndAbGame.id,
    name: aufUndAbGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player) => {
      const stock = deck.splice(0, stockSize);
      return {
        id: player.id,
        name: player.name,
        hand: [],
        handCount: 0,
        stock,
        stockCount: stock.length,
        discards: Array.from({ length: DISCARD_PILES }, () => []),
        stats: { played: 0, fromStock: 0, jokers: 0, completed: 0 }
      };
    }),
    state: {
      currentPlayerId: null,
      turnOrder,
      startPlayerId,
      stockSize,
      deck,
      deckCount: deck.length,
      buildPiles: emptyBuildPiles(),
      completedPiles: 0,
      reshuffles: 0,
      idleTurns: 0,
      builtThisTurn: false,
      turnNumber: 0,
      winnerId: null,
      winnerIds: [],
      isDraw: false,
      moveCount: 0,
      lastEvent: null
    }
  };
  for (const player of session.players) refillHand(session, player);
  session.state.currentPlayerId = startPlayerId;
  session.state.turnNumber = 1;
  setEvent(session, { type: 'start', playerId: startPlayerId, text: `${nameOf(session, startPlayerId)} beginnt. Jeder hat ${stockSize} Karten im Vorrat.` });
  return session;
}

/** @param {AufSession} session @param {AufPlayer} player */
function finish(session, player) {
  session.status = 'finished';
  session.state.currentPlayerId = null;
  session.state.winnerId = player.id;
  session.state.winnerIds = [player.id];
  session.state.isDraw = false;
  setEvent(session, { type: 'win', playerId: player.id, text: `${player.name} hat den Vorrat leer gespielt und gewinnt!` });
}

const SOURCE_TEXT = { hand: 'von der Hand', stock: 'aus dem Vorrat', discard: 'von der Ablage' };

/**
 * @param {AufSession} session
 * @param {string} playerId
 * @param {AufMove} move
 * @returns {{ session: AufSession } | { error: string }}
 */
export function makeAufUndAbMove(session, playerId, move) {
  const { state } = session;
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du spielst in dieser Runde nicht mit.' };
  if (session.status !== 'running') return { error: 'Das Spiel ist schon vorbei.' };
  if (state.currentPlayerId !== playerId) return { error: 'Du bist nicht am Zug.' };

  if (move?.type === 'play') {
    const pile = state.buildPiles.find((candidate) => candidate.id === move.pileId);
    if (!pile) return { error: 'Diesen Stapel gibt es nicht.' };

    /** @type {AufCard | undefined} */
    let card;
    /** @type {() => void} */
    let take;
    if (move.source === 'hand') {
      const index = player.hand.findIndex((candidate) => candidate.id === move.cardId);
      card = player.hand[index];
      take = () => player.hand.splice(index, 1);
    } else if (move.source === 'stock') {
      card = player.stock[0];
      take = () => player.stock.shift();
    } else if (move.source === 'discard') {
      const discardPile = player.discards[Number(move.discardIndex)];
      card = discardPile?.[discardPile.length - 1];
      take = () => discardPile.pop();
    } else {
      return { error: 'Woher soll die Karte kommen?' };
    }
    if (!card) return { error: 'Diese Karte kannst du gerade nicht spielen.' };
    if (!canPlay(card, pile)) return { error: `Hier muss eine ${nextValue(pile)} hin.` };

    const value = nextValue(pile);
    take();
    pile.cards.push({ card, value });
    state.builtThisTurn = true;
    player.stats.played += 1;
    if (move.source === 'stock') player.stats.fromStock += 1;
    if (isJoker(card)) player.stats.jokers += 1;
    state.moveCount += 1;
    const pileLabel = BUILD_PILES.find((candidate) => candidate.id === pile.id)?.dir === 'up' ? 'Auf' : 'Ab';
    let text = `${player.name} legt ${isJoker(card) ? `Joker als ${value}` : value} ${SOURCE_TEXT[move.source]} auf ${pileLabel}.`;
    /** @type {AufEventType} */
    let type = 'play';

    if (isPileDone(pile)) {
      // Fertiger Stapel: Karten gemischt unter den Nachziehstapel.
      state.deck.unshift(...shuffle(pile.cards.map((entry) => entry.card)));
      pile.cards = [];
      state.completedPiles += 1;
      player.stats.completed += 1;
      type = 'complete';
      text = `${player.name} macht einen ${pileLabel}-Stapel voll (${value})!`;
    }
    syncCounts(player);

    if (player.stock.length === 0) {
      finish(session, player);
      return { session };
    }
    if (player.hand.length === 0 && move.source === 'hand') {
      refillHand(session, player);
      if (player.hand.length) {
        type = type === 'complete' ? type : 'refill';
        text += ' Hand leer – 5 neue Karten.';
      }
    }
    state.deckCount = state.deck.length;
    setEvent(session, { type, playerId, card, value, pileId: pile.id, source: String(move.source), text });
    return { session };
  }

  if (move?.type === 'discard') {
    const index = player.hand.findIndex((candidate) => candidate.id === move.cardId);
    const discardIndex = Number(move.discardIndex);
    if (index === -1) return { error: 'Diese Karte hast du nicht auf der Hand.' };
    if (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= DISCARD_PILES) return { error: 'Wähle einen deiner Ablagestapel.' };
    const [card] = player.hand.splice(index, 1);
    player.discards[discardIndex].push(card);
    syncCounts(player);
    state.moveCount += 1;
    setEvent(session, { type: 'discard', playerId, card, text: `${player.name} legt ${cardName(card)} ab. Zug beendet.` });
    startTurn(session, playerAfter(session, playerId));
    return { session };
  }

  if (move?.type === 'end-turn') {
    if (player.hand.length > 0) return { error: 'Lege zum Beenden eine Handkarte ab.' };
    state.moveCount += 1;
    setEvent(session, { type: 'end-turn', playerId, text: `${player.name} hat keine Handkarte mehr und beendet den Zug.` });
    startTurn(session, playerAfter(session, playerId));
    return { session };
  }

  return { error: 'Unbekannter Zug.' };
}

/**
 * Fremde Hände, der Vorrat unter der obersten Karte und der Nachziehstapel bleiben geheim.
 * @param {AufSession} session
 * @param {string | null} viewerId
 */
export function redactAufUndAbSession(session, viewerId) {
  const reveal = session.status === 'finished';
  for (const player of session.players) {
    syncCounts(player);
    if (!reveal && (!viewerId || player.id !== viewerId)) player.hand = [];
    player.stock = player.stock.slice(0, 1);
  }
  const state = /** @type {Partial<AufState>} */ (session.state);
  if (Array.isArray(state.deck)) {
    state.deckCount = state.deck.length;
    delete state.deck;
  }
  return session;
}
