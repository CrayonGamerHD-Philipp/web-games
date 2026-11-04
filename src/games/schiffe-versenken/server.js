/**
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {'h' | 'v'} ShipDir
 * @typedef {{ id: string, name: string, length: number }} FleetEntry
 * @typedef {{ id: string, name: string, length: number, x: number, y: number, dir: ShipDir, hits: number, sunk: boolean }} SchiffeShip
 * @typedef {{ x: number, y: number, result: 'hit' | 'miss' }} SchiffeShot
 * @typedef {{ id: string, name: string, ready: boolean, placed: boolean, ships: SchiffeShip[], incoming: SchiffeShot[], sunkCount: number }} SchiffePlayer
 * @typedef {{ seq: number, shooterId: string, targetId: string, x: number, y: number, result: 'hit' | 'miss' | 'sunk', shipName: string | null }} SchiffeLastShot
 * @typedef {{ phase: 'placement' | 'battle' | 'finished', size: number, fleet: FleetEntry[], currentPlayerId: string | null, winnerId: string | null, isDraw: boolean, lastShot: SchiffeLastShot | null, shotCount: number, extraShotOnHit?: boolean }} SchiffeState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: SchiffePlayer[], state: SchiffeState }} SchiffeSession
 * @typedef {{ x?: unknown, y?: unknown, length?: unknown, dir?: unknown }} RawShip
 * @typedef {{ type?: unknown, ships?: unknown, x?: unknown, y?: unknown }} SchiffeMoveInput
 */

export const schiffeVersenkenGame = {
  id: 'schiffe-versenken',
  name: 'Schiffe versenken',
  description: 'Flotte verstecken, Koordinaten ansagen, Schiffe versenken – das Seeduell für zwei.',
  previewImage: '/images/schiffe-versenken-scene.webp',
  minPlayers: 2,
  maxPlayers: 2
};

export const BOARD_SIZE = 10;

/** @type {FleetEntry[]} */
export const FLEET = [
  { id: 'schlachtschiff', name: 'Schlachtschiff', length: 5 },
  { id: 'kreuzer', name: 'Kreuzer', length: 4 },
  { id: 'zerstoerer-1', name: 'Zerstörer', length: 3 },
  { id: 'zerstoerer-2', name: 'Zerstörer', length: 3 },
  { id: 'u-boot', name: 'U-Boot', length: 2 }
];

/**
 * @param {{ x: number, y: number, length: number, dir: ShipDir }} ship
 * @returns {{ x: number, y: number }[]}
 */
export function shipCells(ship) {
  const cells = [];
  for (let i = 0; i < ship.length; i += 1) {
    cells.push(ship.dir === 'h' ? { x: ship.x + i, y: ship.y } : { x: ship.x, y: ship.y + i });
  }
  return cells;
}

/** @param {unknown} value */
function isCoord(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0 && /** @type {number} */ (value) < BOARD_SIZE;
}

/**
 * Validates a complete fleet and returns normalized ships.
 * @param {unknown} rawShips
 * @returns {{ ships: SchiffeShip[] } | { error: string }}
 */
export function validateFleet(rawShips) {
  if (!Array.isArray(rawShips) || rawShips.length !== FLEET.length) {
    return { error: `Deine Flotte muss aus genau ${FLEET.length} Schiffen bestehen.` };
  }

  const remaining = [...FLEET];
  const occupied = new Set();
  /** @type {SchiffeShip[]} */
  const ships = [];

  for (const raw of /** @type {RawShip[]} */ (rawShips)) {
    if (!raw || typeof raw !== 'object') return { error: 'Ein Schiff ist ungültig.' };
    const x = Number(raw.x);
    const y = Number(raw.y);
    const length = Number(raw.length);
    const dir = raw.dir;

    if (dir !== 'h' && dir !== 'v') return { error: 'Schiffe liegen waagerecht oder senkrecht.' };
    if (!isCoord(x) || !isCoord(y)) return { error: 'Ein Schiff liegt außerhalb des Spielfelds.' };

    const fleetIndex = remaining.findIndex((entry) => entry.length === length);
    if (fleetIndex === -1) return { error: 'Die Flotte passt nicht: 1×5, 1×4, 2×3 und 1×2 Felder.' };
    const entry = remaining.splice(fleetIndex, 1)[0];

    const endX = dir === 'h' ? x + length - 1 : x;
    const endY = dir === 'v' ? y + length - 1 : y;
    if (endX >= BOARD_SIZE || endY >= BOARD_SIZE) return { error: `${entry.name} ragt über den Rand hinaus.` };

    for (const cell of shipCells({ x, y, length, dir })) {
      const key = cell.y * BOARD_SIZE + cell.x;
      if (occupied.has(key)) return { error: 'Schiffe dürfen sich nicht überlappen.' };
      occupied.add(key);
    }

    ships.push({ id: entry.id, name: entry.name, length, x, y, dir, hits: 0, sunk: false });
  }

  if (remaining.length > 0) return { error: 'Deine Flotte ist nicht vollständig.' };

  ships.sort((a, b) => FLEET.findIndex((entry) => entry.id === a.id) - FLEET.findIndex((entry) => entry.id === b.id));
  return { ships };
}

/**
 * Places the standard fleet at random positions.
 * @param {() => number} [random]
 */
export function randomFleet(random = Math.random) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const occupied = new Set();
    /** @type {{ x: number, y: number, length: number, dir: ShipDir }[]} */
    const ships = [];
    let failed = false;

    for (const entry of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries += 1) {
        /** @type {ShipDir} */
        const dir = random() < 0.5 ? 'h' : 'v';
        const maxX = dir === 'h' ? BOARD_SIZE - entry.length : BOARD_SIZE - 1;
        const maxY = dir === 'v' ? BOARD_SIZE - entry.length : BOARD_SIZE - 1;
        const x = Math.floor(random() * (maxX + 1));
        const y = Math.floor(random() * (maxY + 1));
        const cells = shipCells({ x, y, length: entry.length, dir });
        if (cells.some((cell) => occupied.has(cell.y * BOARD_SIZE + cell.x))) continue;
        for (const cell of cells) occupied.add(cell.y * BOARD_SIZE + cell.x);
        ships.push({ x, y, length: entry.length, dir });
        placed = true;
      }
      if (!placed) {
        failed = true;
        break;
      }
    }

    if (!failed) return ships;
  }

  throw new Error('Flotte konnte nicht platziert werden.');
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {SchiffeSession | { error: string }}
 */
export function createSchiffeVersenkenSession(players, options = {}) {
  // Hausregel: Bei einem Treffer darf man nochmal schießen (Standard: an).
  const extraShotOnHit = options.extraShotOnHit !== false && options.extraShotOnHit !== 'false';
  const selectedPlayers = players.slice(0, 2);

  if (selectedPlayers.length < schiffeVersenkenGame.minPlayers) {
    return { error: 'Schiffe versenken braucht genau zwei Spieler.' };
  }

  return {
    id: crypto.randomUUID(),
    gameId: schiffeVersenkenGame.id,
    name: schiffeVersenkenGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selectedPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      ready: false,
      placed: false,
      ships: [],
      incoming: [],
      sunkCount: 0
    })),
    state: {
      phase: 'placement',
      size: BOARD_SIZE,
      fleet: FLEET.map((entry) => ({ ...entry })),
      currentPlayerId: null,
      winnerId: null,
      isDraw: false,
      lastShot: null,
      shotCount: 0,
      extraShotOnHit
    }
  };
}

/**
 * @param {SchiffeSession} session
 * @param {string} playerId
 * @param {SchiffeMoveInput} move
 * @returns {{ session: SchiffeSession } | { error: string }}
 */
export function makeSchiffeVersenkenMove(session, playerId, move) {
  if (session.status !== 'running' || session.state.phase === 'finished') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }

  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du schaust in dieser Runde nur zu.' };

  const opponent = session.players.find((candidate) => candidate.id !== playerId);
  if (!opponent) return { error: 'Es fehlt ein Gegner.' };

  const type = move && typeof move === 'object' ? move.type : undefined;

  if (type === 'place-fleet' || type === 'random-fleet' || type === 'ready') {
    if (session.state.phase !== 'placement') return { error: 'Die Flotten sind bereits aufgestellt.' };
    if (player.ready) return { error: 'Du bist schon bereit – die Flotte ist fest.' };

    if (type === 'ready') {
      if (!player.placed || player.ships.length !== FLEET.length) {
        return { error: 'Stell zuerst deine ganze Flotte auf.' };
      }
      player.ready = true;

      if (session.players.every((candidate) => candidate.ready)) {
        session.state.phase = 'battle';
        session.state.currentPlayerId = session.players[Math.floor(Math.random() * session.players.length)].id;
      }
      return { session };
    }

    const result = validateFleet(type === 'random-fleet' ? randomFleet() : move.ships);
    if ('error' in result) return { error: result.error };
    player.ships = result.ships;
    player.placed = true;
    return { session };
  }

  if (type === 'shoot') {
    if (session.state.phase !== 'battle') return { error: 'Geschossen wird erst, wenn beide Flotten bereit sind.' };
    if (session.state.currentPlayerId !== playerId) return { error: 'Du bist noch nicht am Zug.' };

    const x = Number(move.x);
    const y = Number(move.y);
    if (!isCoord(x) || !isCoord(y)) return { error: 'Dieses Feld liegt außerhalb des Spielfelds.' };
    if (opponent.incoming.some((shot) => shot.x === x && shot.y === y)) {
      return { error: 'Auf dieses Feld hast du schon geschossen.' };
    }

    const ship = opponent.ships.find((candidate) => shipCells(candidate).some((cell) => cell.x === x && cell.y === y));
    opponent.incoming.push({ x, y, result: ship ? 'hit' : 'miss' });
    session.state.shotCount += 1;

    /** @type {'hit' | 'miss' | 'sunk'} */
    let result = 'miss';
    if (ship) {
      ship.hits += 1;
      result = 'hit';
      if (ship.hits >= ship.length) {
        ship.sunk = true;
        result = 'sunk';
        opponent.sunkCount = opponent.ships.filter((candidate) => candidate.sunk).length;
      }
    }

    session.state.lastShot = {
      seq: session.state.shotCount,
      shooterId: playerId,
      targetId: opponent.id,
      x,
      y,
      result,
      shipName: result === 'sunk' && ship ? ship.name : null
    };

    if (opponent.ships.every((candidate) => candidate.sunk)) {
      session.status = 'finished';
      session.state.phase = 'finished';
      session.state.winnerId = playerId;
      session.state.currentPlayerId = null;
      return { session };
    }

    // A hit earns another shot; a miss passes the turn.
    if (result === 'miss' || session.state.extraShotOnHit === false) session.state.currentPlayerId = opponent.id;
    return { session };
  }

  return { error: 'Unbekannter Spielzug.' };
}

/**
 * Hides every ship the viewer must not see. Receives a deep clone and mutates it.
 * @param {SchiffeSession} session
 * @param {string | null} viewerId
 */
export function redactSchiffeVersenkenSession(session, viewerId) {
  for (const player of session.players ?? []) {
    if (player.id === viewerId) continue;
    player.ships = (player.ships ?? []).filter((ship) => ship.sunk);
  }
  return session;
}
