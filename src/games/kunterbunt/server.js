/**
 * Kunterbunt – farbenfrohes Ablegespiel mit 108 Karten in vier Farben.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./rules.js').BuntColor} BuntColor
 * @typedef {import('./rules.js').BuntValue} BuntValue
 * @typedef {import('./rules.js').BuntCard} BuntCard
 * @typedef {{ id: string, name: string, hand: BuntCard[], handCount: number }} BuntPlayer
 * @typedef {'start' | 'play' | 'wish' | 'skip' | 'reverse' | 'stack' | 'draw' | 'draw-pending' | 'pass' | 'no-cards' | 'bunt' | 'bunt-penalty' | 'win'} BuntEventType
 * @typedef {{ seq: number, type: BuntEventType, playerId: string | null, card?: BuntCard, text: string, reshuffled?: boolean, penalty?: number }} BuntEvent
 * @typedef {{
 *   currentPlayerId: string | null,
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   deck: BuntCard[],
 *   deckCount: number,
 *   discardPile: BuntCard[],
 *   discardCount: number,
 *   pendingDraw: number,
 *   wishColor: BuntColor | null,
 *   direction: 1 | -1,
 *   hasDrawn: boolean,
 *   drawnCardId: string | null,
 *   turnOrder: string[],
 *   startPlayerId: string | null,
 *   moveCount: number,
 *   lastEvent: BuntEvent | null
 * }} BuntState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: BuntPlayer[], state: BuntState }} BuntSession
 * @typedef {{ type?: unknown, cardId?: unknown, wishColor?: unknown, bunt?: unknown }} BuntMove
 */

import {
  BUNT_COLORS,
  BUNT_COLOR_NAMES,
  BUNT_NUMBERS,
  buntCardName,
  isBuntCardPlayable,
  isBuntNumber,
  isBuntWild
} from './rules.js';

export { BUNT_COLORS, buntCardName, isBuntCardPlayable };

export const kunterbuntGame = {
  id: 'kunterbunt',
  name: 'Kunterbunt',
  description: 'Farbe oder Zahl bedienen, +2 und +4 weiterreichen, Farben wünschen – und vor der letzten Karte „Bunt!“ rufen.',
  previewImage: '/images/kunterbunt-scene.webp',
  minPlayers: 2,
  maxPlayers: 8
};

export const HAND_SIZE = 7;
export const BUNT_PENALTY = 2;
/** Discard cards sent to clients (the rest is history nobody can use). */
const VISIBLE_DISCARD = 6;

/** @returns {BuntCard[]} */
export function createKunterbuntDeck() {
  /** @type {BuntCard[]} */
  const cards = [];
  let serial = 0;
  /** @param {BuntColor | null} color @param {BuntValue} value */
  const add = (color, value) => {
    serial += 1;
    cards.push({ id: `${crypto.randomUUID().slice(0, 8)}${serial.toString(36)}`, color, value });
  };
  for (const color of BUNT_COLORS) {
    add(color, '0');
    for (const value of BUNT_NUMBERS.slice(1)) {
      add(color, value);
      add(color, value);
    }
    for (const value of /** @type {BuntValue[]} */ (['plus2', 'skip', 'reverse'])) {
      add(color, value);
      add(color, value);
    }
  }
  for (let index = 0; index < 4; index += 1) {
    add(null, 'wild');
    add(null, 'wild4');
  }
  return shuffle(cards);
}

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

/** @param {BuntPlayer} player */
function syncCount(player) {
  player.handCount = player.hand.length;
}

/** @param {BuntSession} session */
function syncPiles(session) {
  session.state.deckCount = session.state.deck.length;
  session.state.discardCount = session.state.discardPile.length;
}

/**
 * Draws one card, reshuffling the discard pile (except the top card) when the deck is empty.
 * @param {BuntSession} session
 * @returns {{ card: BuntCard | null, reshuffled: boolean }}
 */
function drawOne(session) {
  const { state } = session;
  let reshuffled = false;
  if (state.deck.length === 0 && state.discardPile.length > 1) {
    const top = /** @type {BuntCard} */ (state.discardPile.pop());
    state.deck = shuffle(state.discardPile.map((card) => (isBuntWild(card.value) ? { ...card, wishColor: null } : card)));
    state.discardPile = [top];
    reshuffled = true;
  }
  const card = state.deck.pop() ?? null;
  syncPiles(session);
  return { card, reshuffled };
}

/**
 * @param {BuntSession} session
 * @param {BuntPlayer} player
 * @param {number} amount
 */
function drawInto(session, player, amount) {
  /** @type {BuntCard[]} */
  const drawn = [];
  let reshuffled = false;
  for (let index = 0; index < amount; index += 1) {
    const result = drawOne(session);
    reshuffled ||= result.reshuffled;
    if (!result.card) break;
    player.hand.push(result.card);
    drawn.push(result.card);
  }
  syncCount(player);
  return { drawn, reshuffled };
}

/**
 * @param {BuntSession} session
 * @param {string} playerId
 * @param {number} steps
 */
function playerAfter(session, playerId, steps) {
  const order = session.state.turnOrder;
  const index = order.indexOf(playerId);
  const length = order.length;
  return order[(((index + steps * session.state.direction) % length) + length) % length];
}

/**
 * @param {BuntSession} session
 * @param {string} playerId
 * @param {number} [steps]
 */
function endTurn(session, playerId, steps = 1) {
  session.state.currentPlayerId = playerAfter(session, playerId, steps);
  session.state.hasDrawn = false;
  session.state.drawnCardId = null;
}

/** @param {BuntSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/**
 * @param {BuntSession} session
 * @param {Omit<BuntEvent, 'seq'>} event
 */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {BuntSession | { error: string }}
 */
export function createKunterbuntSession(players, options = {}) {
  const handSize = [5, 7, 10].includes(Number(options.handSize)) ? Number(options.handSize) : HAND_SIZE;
  const selected = (Array.isArray(players) ? players : []).slice(0, kunterbuntGame.maxPlayers);
  if (selected.length < kunterbuntGame.minPlayers) {
    return { error: 'Kunterbunt braucht mindestens zwei Spieler.' };
  }

  let deck = createKunterbuntDeck();

  /** @type {BuntPlayer[]} */
  const buntPlayers = selected.map((player) => ({ id: player.id, name: player.name, hand: [], handCount: 0 }));
  for (let round = 0; round < handSize; round += 1) {
    for (const player of buntPlayers) {
      const card = deck.pop();
      if (card) player.hand.push(card);
    }
  }
  buntPlayers.forEach(syncCount);

  // The start card must be a number card: action and wish cards go back and the deck is reshuffled.
  let startCard = /** @type {BuntCard} */ (deck.pop());
  while (!isBuntNumber(startCard.value)) {
    deck.push(startCard);
    deck = shuffle(deck);
    startCard = /** @type {BuntCard} */ (deck.pop());
  }

  const turnOrder = buntPlayers.map((player) => player.id);
  const startPlayerId = turnOrder[Math.floor(Math.random() * turnOrder.length)];

  /** @type {BuntSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: kunterbuntGame.id,
    name: kunterbuntGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: buntPlayers,
    state: {
      currentPlayerId: startPlayerId,
      winnerId: null,
      isDraw: false,
      deck,
      deckCount: deck.length,
      discardPile: [startCard],
      discardCount: 1,
      pendingDraw: 0,
      wishColor: null,
      direction: 1,
      hasDrawn: false,
      drawnCardId: null,
      turnOrder,
      startPlayerId,
      moveCount: 0,
      lastEvent: null
    }
  };

  setEvent(session, {
    type: 'start',
    playerId: startPlayerId,
    card: startCard,
    text: `${nameOf(session, startPlayerId)} beginnt. Startkarte: ${buntCardName(startCard)}.`
  });
  return session;
}

/**
 * @param {BuntSession} session
 * @param {string} playerId
 * @param {BuntMove} move
 * @returns {{ session: BuntSession } | { error: string }}
 */
export function makeKunterbuntMove(session, playerId, move) {
  if (!session || session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return { error: 'Du spielst in dieser Runde nur als Zuschauer mit.' };
  }
  if (session.state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }
  const type = move && typeof move === 'object' ? move.type : undefined;

  if (type === 'play') return playCard(session, player, move);
  if (type === 'draw') return drawCard(session, player);
  if (type === 'pass') return passTurn(session, player);
  return { error: 'Unbekannter Spielzug.' };
}

/**
 * @param {BuntSession} session
 * @param {BuntPlayer} player
 * @param {BuntMove} move
 * @returns {{ session: BuntSession } | { error: string }}
 */
function playCard(session, player, move) {
  const { state } = session;
  const cardId = typeof move.cardId === 'string' ? move.cardId : '';
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) {
    return { error: 'Diese Karte hast du nicht auf der Hand.' };
  }
  const card = player.hand[cardIndex];

  if (state.hasDrawn && state.drawnCardId !== card.id) {
    return { error: 'Nach dem Ziehen darfst du nur die gezogene Karte legen – oder weitergeben.' };
  }
  if (!isBuntCardPlayable(card, state)) {
    const top = state.discardPile[state.discardPile.length - 1];
    if (state.pendingDraw > 0) {
      return top?.value === 'wild4'
        ? { error: `Du musst ${state.pendingDraw} Karten ziehen oder eine +4 drauflegen.` }
        : { error: `Du musst ${state.pendingDraw} Karten ziehen oder eine +2 oder +4 drauflegen.` };
    }
    if (state.wishColor) return { error: `Gewünscht ist ${BUNT_COLOR_NAMES[state.wishColor]}.` };
    return { error: 'Diese Karte passt nicht auf die Ablage.' };
  }

  const isWinningCard = player.hand.length === 1;
  /** @type {BuntColor | null} */
  let wishColor = null;
  if (isBuntWild(card.value)) {
    const wanted = /** @type {BuntColor} */ (move.wishColor);
    if (typeof move.wishColor === 'string' && BUNT_COLORS.includes(wanted)) {
      wishColor = wanted;
    } else if (!isWinningCard) {
      return { error: 'Wähle eine Farbe für deinen Farbwunsch.' };
    }
  }

  // Apply the card.
  player.hand.splice(cardIndex, 1);
  syncCount(player);
  /** @type {BuntCard} */
  const played = isBuntWild(card.value) ? { ...card, wishColor } : card;
  state.discardPile.push(played);
  syncPiles(session);
  state.wishColor = wishColor;
  state.hasDrawn = false;
  state.drawnCardId = null;
  state.moveCount += 1;

  if (player.hand.length === 0) {
    session.status = 'finished';
    state.winnerId = player.id;
    state.currentPlayerId = null;
    state.pendingDraw = 0;
    setEvent(session, { type: 'win', playerId: player.id, card: played, text: `Kunterbunt! ${player.name} hat gewonnen.` });
    return { session };
  }

  const name = buntCardName(played);
  const twoPlayers = state.turnOrder.length === 2;
  let steps = 1;
  /** @type {BuntEventType} */
  let type = 'play';
  let text = `${player.name} legt ${name}.`;

  if (card.value === 'plus2' || card.value === 'wild4') {
    state.pendingDraw += card.value === 'plus2' ? 2 : 4;
    type = 'stack';
    const nextName = nameOf(session, playerAfter(session, player.id, 1));
    const wishText = wishColor ? ` und wünscht sich ${BUNT_COLOR_NAMES[wishColor]}` : '';
    const counter = card.value === 'wild4' ? 'eine +4' : 'eine +2 oder +4';
    text = `${player.name} legt ${name}${wishText} – ${nextName} muss ${state.pendingDraw} ziehen oder ${counter} drauflegen.`;
  } else if (card.value === 'skip') {
    steps = 2;
    type = 'skip';
    const skippedId = playerAfter(session, player.id, 1);
    text = skippedId === player.id
      ? `${player.name} legt ${name} und ist gleich noch mal dran.`
      : `${player.name} legt ${name} – ${nameOf(session, skippedId)} setzt aus.`;
  } else if (card.value === 'reverse') {
    state.direction = state.direction === 1 ? -1 : 1;
    type = 'reverse';
    if (twoPlayers) {
      steps = 2;
      text = `${player.name} legt ${name} – bei zwei Spielern heißt das: noch mal dran.`;
    } else {
      text = `${player.name} legt ${name} – die Reihenfolge dreht sich um.`;
    }
  } else if (card.value === 'wild' && wishColor) {
    type = 'wish';
    text = `${player.name} legt ${name} und wünscht sich ${BUNT_COLOR_NAMES[wishColor]}.`;
  }

  /** @type {number | undefined} */
  let penalty;
  if (player.hand.length === 1) {
    if (move.bunt === true) {
      type = 'bunt';
      text = `${text} „Bunt!“`;
    } else {
      const { drawn } = drawInto(session, player, BUNT_PENALTY);
      type = 'bunt-penalty';
      penalty = drawn.length;
      text = drawn.length
        ? `${text} ${player.name} hat „Bunt!“ vergessen und zieht ${drawn.length === 1 ? 'eine Strafkarte' : `${drawn.length} Strafkarten`}.`
        : `${text} ${player.name} hat „Bunt!“ vergessen – aber es gibt keine Strafkarten mehr.`;
    }
  }

  endTurn(session, player.id, steps);
  setEvent(session, { type, playerId: player.id, card: played, text, ...(penalty !== undefined ? { penalty } : {}) });
  return { session };
}

/**
 * @param {BuntSession} session
 * @param {BuntPlayer} player
 * @returns {{ session: BuntSession } | { error: string }}
 */
function drawCard(session, player) {
  const { state } = session;
  if (state.hasDrawn) {
    return { error: 'Du hast schon gezogen. Leg die Karte oder gib weiter.' };
  }
  state.moveCount += 1;

  if (state.pendingDraw > 0) {
    const amount = state.pendingDraw;
    const { drawn, reshuffled } = drawInto(session, player, amount);
    state.pendingDraw = 0;
    endTurn(session, player.id);
    const text = drawn.length === amount
      ? `${player.name} zieht ${amount} Karten und setzt aus.`
      : `${player.name} zieht ${drawn.length} statt ${amount} Karten – der Stapel ist leer.`;
    setEvent(session, { type: 'draw-pending', playerId: player.id, text, reshuffled });
    return { session };
  }

  const { drawn, reshuffled } = drawInto(session, player, 1);
  const card = drawn[0];
  if (!card) {
    endTurn(session, player.id);
    setEvent(session, { type: 'no-cards', playerId: player.id, text: `Keine Karte mehr zum Ziehen – ${player.name} gibt weiter.` });
    return { session };
  }

  if (isBuntCardPlayable(card, state)) {
    state.hasDrawn = true;
    state.drawnCardId = card.id;
    setEvent(session, { type: 'draw', playerId: player.id, text: `${player.name} zieht eine Karte und darf sie legen.`, reshuffled });
  } else {
    endTurn(session, player.id);
    setEvent(session, { type: 'draw', playerId: player.id, text: `${player.name} zieht eine Karte.`, reshuffled });
  }
  return { session };
}

/**
 * @param {BuntSession} session
 * @param {BuntPlayer} player
 * @returns {{ session: BuntSession } | { error: string }}
 */
function passTurn(session, player) {
  if (!session.state.hasDrawn) {
    return { error: 'Weitergeben geht erst, nachdem du gezogen hast.' };
  }
  session.state.moveCount += 1;
  endTurn(session, player.id);
  setEvent(session, { type: 'pass', playerId: player.id, text: `${player.name} behält die Karte und gibt weiter.` });
  return { session };
}

/**
 * Receives a deep clone; hides every hand except the viewer's, the draw pile and old discards.
 * @param {BuntSession} session
 * @param {string | null} viewerId
 */
export function redactKunterbuntSession(session, viewerId) {
  // Nach Spielende darf jeder sehen, was die anderen noch auf der Hand hatten.
  const revealHands = session.status === 'finished';
  for (const player of session.players) {
    player.handCount = player.hand.length;
    if (!revealHands && (!viewerId || player.id !== viewerId)) player.hand = [];
  }
  const state = /** @type {Partial<BuntState>} */ (session.state);
  if (Array.isArray(state.deck)) {
    state.deckCount = state.deck.length;
    delete state.deck;
  }
  if (Array.isArray(state.discardPile)) {
    state.discardCount = state.discardPile.length;
    state.discardPile = state.discardPile.slice(-VISIBLE_DISCARD);
  }
  if (!viewerId || state.currentPlayerId !== viewerId) {
    state.drawnCardId = null;
  }
  return session;
}
