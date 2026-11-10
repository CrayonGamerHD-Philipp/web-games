<script>
  import { onDestroy } from 'svelte';
  import { Check, LoaderCircle, RotateCw, Shuffle, Undo2 } from '@lucide/svelte';
  import SeaBoard from './SeaBoard.svelte';
  import FleetStatus from './FleetStatus.svelte';
  import { FLEET, blockedSet, randomFleet } from '../server.js';
  import { playerHexById } from '$lib/player-colors.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

  /** @typedef {import('../types').SchiffeSession} SchiffeSession */
  /** @typedef {import('../types').SchiffeMove} SchiffeMove */
  /** @typedef {import('../types').SchiffePlayer} SchiffePlayer */
  /** @typedef {import('../types').SchiffeShip} SchiffeShip */
  /** @typedef {import('../types').SchiffeShot} SchiffeShot */
  /** @typedef {import('../types').SchiffeLastShot} SchiffeLastShot */
  /** @typedef {import('../types').SchiffeFleetEntry} FleetEntry */
  /** @typedef {{ dir: 'h' | 'v', part: 'start' | 'mid' | 'end', sunk: boolean }} CellShip */
  /** @typedef {{ kind: 'island' | 'rock', deco: 'palm' | 'hut' | 'flowers' | 'lighthouse', joins: { t: boolean, r: boolean, b: boolean, l: boolean } }} CellTerrain */
  /** @typedef {{ key: number, x: number, y: number, ship: CellShip | null, terrain?: CellTerrain | null, shot: 'hit' | 'miss' | null, ghost: 'ok' | 'bad' | null, last: boolean, pickable: boolean, label: string }} SeaCell */
  /** @typedef {{ id: string, name: string, length: number, x: number, y: number, dir: 'h' | 'v', sunk?: boolean, hits?: number }} BoardShip */
  /** @typedef {Record<string, { x: number, y: number, dir: 'h' | 'v' }>} Draft */
  /** @typedef {{ cells: Set<number>, ok: boolean } | null} Ghost */

  /** @type {SchiffeSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: SchiffeMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party-Spieler ({ id, name, color, … }) für Avatare in Spielerfarbe. */
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];

  // Kept for the shared game-component API; the board reacts to `game` directly.
  $: void renderNonce;

  const SIZE = 10;
  const ROWS = 'ABCDEFGHIJ';

  const soundSources = {
    select: '/sounds/select1.mp3',
    place: '/sounds/turn_card1.mp3',
    miss: '/sounds/take_card1.mp3',
    hit: '/sounds/ping.mp3',
    win: '/sounds/win2.mp3',
    lose: '/sounds/lose1.mp3'
  };
  const audioCache = new Map();

  /** @param {keyof typeof soundSources} name */
  function playSound(name) {
    if (typeof Audio === 'undefined') return;
    let audio = audioCache.get(name);
    if (!audio) {
      audio = new Audio(soundSources[name]);
      audio.preload = 'metadata';
      audioCache.set(name, audio);
    }
    let volume = 0.85;
    try {
      const stored = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
      if (Number.isFinite(stored)) volume = Math.max(0, Math.min(1, stored));
    } catch {}
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      void audio.play().catch(() => {});
    } catch {}
  }

  const NEUTER_SHIPS = new Set(['Schlachtschiff', 'U-Boot']);

  /**
   * Accusative with article, e.g. "den Kreuzer", "dein U-Boot".
   * @param {string | null | undefined} name
   * @param {'der' | 'dein'} article
   */
  function shipAcc(name, article) {
    if (!name) return article === 'dein' ? 'dein Schiff' : 'das Schiff';
    const neuter = NEUTER_SHIPS.has(name);
    if (article === 'dein') return `${neuter ? 'dein' : 'deinen'} ${name}`;
    return `${neuter ? 'das' : 'den'} ${name}`;
  }

  /** @param {number} x @param {number} y */
  function coord(x, y) {
    return `${ROWS[y]}${x + 1}`;
  }

  /** @param {{ x: number, y: number, length: number, dir: 'h' | 'v' }} ship */
  function cellsOf(ship) {
    const keys = [];
    for (let i = 0; i < ship.length; i += 1) {
      keys.push(ship.dir === 'h' ? ship.y * SIZE + ship.x + i : (ship.y + i) * SIZE + ship.x);
    }
    return keys;
  }

  // ---------- Session-derived values ----------
  $: fleet = /** @type {FleetEntry[]} */ (game?.state.fleet ?? FLEET);
  $: phase = game?.state.phase ?? 'placement';
  $: isFinished = game?.status === 'finished' || phase === 'finished';
  $: me = /** @type {SchiffePlayer | null} */ (game?.players.find((player) => player.id === currentPlayerId) ?? null);
  $: opponent = /** @type {SchiffePlayer | null} */ (me ? game?.players.find((player) => player.id !== currentPlayerId) ?? null : null);
  // "home" is the viewer's own fleet, "target" the sea being shot at. Spectators see player 1 vs. player 2.
  $: homePlayer = /** @type {SchiffePlayer | null} */ (me ?? game?.players[0] ?? null);
  $: targetPlayer = /** @type {SchiffePlayer | null} */ (opponent ?? (me ? null : game?.players[1] ?? null));
  $: isSpectator = !me;
  $: isMyTurn = Boolean(me && phase === 'battle' && !isFinished && game?.state.currentPlayerId === currentPlayerId);
  $: lastShot = /** @type {SchiffeLastShot | null} */ (game?.state.lastShot ?? null);
  /** Lobby-Einstellung: Treffer erlaubt einen weiteren Schuss (Standard). */
  $: extraShot = !(game?.state && 'extraShotOnHit' in game.state && game.state.extraShotOnHit === false);
  $: currentTurnName = game?.players.find((player) => player.id === game?.state.currentPlayerId)?.name ?? '';
  // Inseln und Felsen der Karte – für beide Spieler gleich.
  $: terrain = game?.state.terrain ?? [];
  $: blocked = blockedSet(terrain);
  $: terrainInfo = describeTerrain(terrain);

  /**
   * Verbindet Inselfelder zu Inseln und verteilt Palmen, Hütten, Blumen und einen Leuchtturm.
   * @param {{ x: number, y: number, kind: 'island' | 'rock' }[]} list
   */
  function describeTerrain(list) {
    /** @type {Map<number, { kind: 'island' | 'rock', deco: 'palm' | 'hut' | 'flowers' | 'lighthouse', joins: { t: boolean, r: boolean, b: boolean, l: boolean } }>} */
    const info = new Map();
    const kinds = new Map(list.map((cell) => [cell.y * SIZE + cell.x, cell.kind]));
    /** @param {number} key @param {number} dx @param {number} dy */
    const islandAt = (key, dx, dy) => {
      const x = (key % SIZE) + dx;
      const y = Math.floor(key / SIZE) + dy;
      return x >= 0 && y >= 0 && x < SIZE && y < SIZE && kinds.get(y * SIZE + x) === 'island';
    };
    const seen = new Set();
    for (const [start, kind] of kinds) {
      if (kind === 'rock') {
        info.set(start, { kind, deco: 'palm', joins: { t: false, r: false, b: false, l: false } });
        continue;
      }
      if (seen.has(start)) continue;
      // Eine Insel einsammeln.
      const island = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const key = /** @type {number} */ (stack.pop());
        island.push(key);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!islandAt(key, dx, dy)) continue;
          const next = key + dy * SIZE + dx;
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
      island.sort((a, b) => a - b);
      /** @type {('palm' | 'hut' | 'flowers')[]} */
      const cycle = ['palm', 'hut', 'flowers', 'palm'];
      island.forEach((key, index) => {
        const deco = index === 0 && island.length >= 4 ? 'lighthouse' : cycle[(key * 7 + index) % cycle.length];
        info.set(key, {
          kind: 'island',
          deco,
          joins: { t: islandAt(key, 0, -1), r: islandAt(key, 1, 0), b: islandAt(key, 0, 1), l: islandAt(key, -1, 0) }
        });
      });
    }
    return info;
  }

  // ---------- Placement draft ----------
  /** @type {Draft} */
  let draft = {};
  let draftForGame = '';
  /** @type {string | null} */
  let heldId = FLEET[0].id;
  /** @type {'h' | 'v'} */
  let dir = 'h';
  /** @type {{ x: number, y: number } | null} */
  let hover = null;
  let notice = '';
  /** '' | 'sent' | 'loading' – Bereit sends place-fleet first, then ready once the server has the fleet. */
  let readyStage = '';

  $: if (game && draftForGame !== game.id) {
    draftForGame = game.id;
    draft = draftFromShips(me?.ships ?? []);
    heldId = firstUnplaced(fleet, draft);
  }

  /** @param {SchiffeShip[]} ships */
  function draftFromShips(ships) {
    /** @type {Draft} */
    const next = {};
    for (const ship of ships) next[ship.id] = { x: ship.x, y: ship.y, dir: ship.dir };
    return next;
  }

  /** @param {FleetEntry[]} fleetList @param {Draft} draftMap */
  function firstUnplaced(fleetList, draftMap) {
    return fleetList.find((entry) => !draftMap[entry.id])?.id ?? null;
  }

  /** @param {FleetEntry[]} fleetList @param {Draft} draftMap @returns {BoardShip[]} */
  function draftShips(fleetList, draftMap) {
    return fleetList
      .filter((entry) => draftMap[entry.id])
      .map((entry) => ({ id: entry.id, name: entry.name, length: entry.length, ...draftMap[entry.id] }));
  }

  /** @param {BoardShip[]} ships */
  function toPayload(ships) {
    return ships.map((ship) => ({ x: ship.x, y: ship.y, length: ship.length, dir: ship.dir }));
  }

  /**
   * @param {{ x: number, y: number, length: number, dir: string }[]} a
   * @param {{ x: number, y: number, length: number, dir: string }[]} b
   */
  function sameFleet(a, b) {
    if (a.length !== b.length) return false;
    /** @param {{ x: number, y: number, length: number, dir: string }} ship */
    const key = (ship) => `${ship.x}:${ship.y}:${ship.length}:${ship.dir}`;
    const left = a.map(key).sort().join('|');
    const right = b.map(key).sort().join('|');
    return left === right;
  }

  /** Keeps the ship on the board by sliding it back from the edge. */
  /** @param {number} length @param {number} x @param {number} y @param {'h' | 'v'} shipDir */
  function clampAnchor(length, x, y, shipDir) {
    return {
      x: shipDir === 'h' ? Math.min(x, SIZE - length) : x,
      y: shipDir === 'v' ? Math.min(y, SIZE - length) : y
    };
  }

  /**
   * @param {BoardShip[]} placed
   * @param {string} shipId
   * @param {{ x: number, y: number, length: number, dir: 'h' | 'v' }} candidate
   */
  function fits(placed, shipId, candidate) {
    const occupied = new Set(placed.filter((ship) => ship.id !== shipId).flatMap(cellsOf));
    return cellsOf(candidate).every((key) => !occupied.has(key) && !blocked.has(key));
  }

  /** @param {BoardShip[]} ships @param {number} x @param {number} y */
  function shipAt(ships, x, y) {
    const key = y * SIZE + x;
    return ships.find((ship) => cellsOf(ship).includes(key)) ?? null;
  }

  /**
   * @param {{ x: number, y: number } | null} hoverCell
   * @param {string | null} shipId
   * @param {'h' | 'v'} shipDir
   * @param {FleetEntry[]} fleetList
   * @param {BoardShip[]} placed
   * @returns {Ghost}
   */
  function computeGhost(hoverCell, shipId, shipDir, fleetList, placed) {
    if (!hoverCell || !shipId) return null;
    const entry = fleetList.find((item) => item.id === shipId);
    if (!entry) return null;
    const anchor = clampAnchor(entry.length, hoverCell.x, hoverCell.y, shipDir);
    const candidate = { ...anchor, length: entry.length, dir: shipDir };
    return { cells: new Set(cellsOf(candidate)), ok: fits(placed, shipId, candidate) };
  }

  $: placedShips = draftShips(fleet, draft);
  $: draftPayload = toPayload(placedShips);
  $: fleetComplete = placedShips.length === fleet.length;
  $: canEditDraft = Boolean(me && phase === 'placement' && !me.ready && !readyStage && !isFinished);
  $: ghost = canEditDraft ? computeGhost(hover, heldId, dir, fleet, placedShips) : null;
  $: heldEntry = fleet.find((entry) => entry.id === heldId) ?? null;

  /** @param {string} shipId */
  function pickUp(shipId) {
    const placement = draft[shipId];
    if (placement) {
      const { [shipId]: _removed, ...rest } = draft;
      draft = rest;
      dir = placement.dir;
    }
    heldId = shipId;
    notice = '';
    playSound('select');
  }

  /** @param {string} shipId */
  function selectShip(shipId) {
    if (!canEditDraft) return;
    if (heldId === shipId && !draft[shipId]) return;
    pickUp(shipId);
  }

  /** @param {number} x @param {number} y */
  function handlePlaceClick(x, y) {
    if (!canEditDraft) return;
    const occupant = shipAt(placedShips, x, y);

    if (heldEntry && !draft[heldEntry.id]) {
      const anchor = clampAnchor(heldEntry.length, x, y, dir);
      const candidate = { ...anchor, length: heldEntry.length, dir };
      if (fits(placedShips, heldEntry.id, candidate)) {
        draft = { ...draft, [heldEntry.id]: { x: anchor.x, y: anchor.y, dir } };
        heldId = firstUnplaced(fleet, draft);
        notice = '';
        playSound('place');
        return;
      }
      if (occupant) {
        pickUp(occupant.id);
        return;
      }
      notice = `Dort ist kein Platz für ${shipAcc(heldEntry.name, 'der')}. Drehen oder anderes Feld wählen.`;
      return;
    }

    if (occupant) pickUp(occupant.id);
  }

  function rotate() {
    if (!canEditDraft) return;
    dir = dir === 'h' ? 'v' : 'h';
    playSound('select');
  }

  function randomize() {
    if (!canEditDraft) return;
    const ships = randomFleet(Math.random, blocked);
    /** @type {Draft} */
    const next = {};
    const pool = [...fleet];
    for (const ship of ships) {
      const index = pool.findIndex((entry) => entry.length === ship.length);
      if (index === -1) continue;
      next[pool.splice(index, 1)[0].id] = { x: ship.x, y: ship.y, dir: ship.dir };
    }
    draft = next;
    heldId = null;
    notice = '';
    playSound('place');
  }

  function clearDraft() {
    if (!canEditDraft) return;
    draft = {};
    heldId = fleet[0]?.id ?? null;
    notice = '';
    playSound('select');
  }

  function confirmReady() {
    if (!canEditDraft || !fleetComplete || isLoading || !me) return;
    playSound('select');
    if (me.placed && sameFleet(me.ships, draftPayload)) {
      onMove({ type: 'ready' });
      return;
    }
    readyStage = 'sent';
    onMove({ type: 'place-fleet', ships: draftPayload });
  }

  /**
   * @param {string} stage
   * @param {boolean} loading
   * @param {SchiffePlayer | null} player
   * @param {{ x: number, y: number, length: number, dir: 'h' | 'v' }[]} payload
   */
  function syncReady(stage, loading, player, payload) {
    if (!stage) return;
    if (!player || player.ready) {
      readyStage = '';
      return;
    }
    if (loading) {
      if (stage === 'sent') readyStage = 'loading';
      return;
    }
    if (player.placed && sameFleet(player.ships, payload)) {
      readyStage = '';
      onMove({ type: 'ready' });
      return;
    }
    // The placement request finished without our fleet (error) – unlock the editor.
    if (stage === 'loading') readyStage = '';
  }

  $: syncReady(readyStage, isLoading, me, draftPayload);

  // ---------- Board cells ----------
  /**
   * @param {BoardShip[]} ships
   * @param {SchiffeShot[]} incoming
   * @param {SchiffeLastShot | null} shot
   * @param {string | null | undefined} ownerId
   * @param {Ghost} ghostInfo
   * @param {{ own: boolean, pickable: boolean }} opts
   * @returns {SeaCell[]}
   */
  function buildCells(ships, incoming, shot, ownerId, ghostInfo, opts) {
    /** @type {Map<number, { ship: BoardShip, index: number }>} */
    const shipMap = new Map();
    for (const ship of ships) {
      cellsOf(ship).forEach((key, index) => shipMap.set(key, { ship, index }));
    }
    /** @type {Map<number, 'hit' | 'miss'>} */
    const shotMap = new Map();
    for (const entry of incoming) shotMap.set(entry.y * SIZE + entry.x, entry.result);
    const lastKey = shot && shot.targetId === ownerId ? shot.y * SIZE + shot.x : -1;

    /** @type {SeaCell[]} */
    const cells = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const key = y * SIZE + x;
        const hit = shipMap.get(key);
        const result = shotMap.get(key) ?? null;
        const ghostState = ghostInfo?.cells.has(key) ? (ghostInfo.ok ? 'ok' : 'bad') : null;
        const land = terrainInfo.get(key) ?? null;
        /** @type {CellShip | null} */
        const cellShip = hit
          ? {
              dir: hit.ship.dir,
              part: hit.index === 0 ? 'start' : hit.index === hit.ship.length - 1 ? 'end' : 'mid',
              sunk: Boolean(hit.ship.sunk)
            }
          : null;

        let text;
        if (land) {
          text = land.kind === 'rock' ? 'Felsen' : land.deco === 'lighthouse' ? 'Insel mit Leuchtturm' : 'Insel';
        } else if (opts.own) {
          if (hit && hit.ship.sunk) text = `eigenes Schiff (${hit.ship.name}), versenkt`;
          else if (hit && result === 'hit') text = `eigenes Schiff (${hit.ship.name}), getroffen`;
          else if (hit) text = `eigenes Schiff (${hit.ship.name})`;
          else if (result === 'miss') text = 'Wasser, Fehlschuss';
          else text = 'Wasser';
          if (ghostState) text += ghostState === 'ok' ? ', Vorschau passt' : ', Vorschau passt nicht';
        } else if (result === 'hit') {
          text = hit?.ship.sunk ? `Treffer, ${hit.ship.name} versenkt` : 'Treffer';
        } else if (result === 'miss') {
          text = 'Wasser';
        } else {
          text = 'noch nicht beschossen';
        }
        if (key === lastKey) text += ', letzter Schuss';

        cells.push({
          key,
          x,
          y,
          ship: cellShip,
          terrain: land,
          shot: result,
          ghost: ghostState,
          last: key === lastKey,
          pickable: Boolean(opts.pickable && hit),
          label: `${coord(x, y)}: ${text}`
        });
      }
    }
    return cells;
  }

  $: inPlacementEditor = canEditDraft || Boolean(readyStage);
  $: homeShips = /** @type {BoardShip[]} */ (inPlacementEditor ? placedShips : homePlayer?.ships ?? []);
  $: homeCells = buildCells(homeShips, homePlayer?.incoming ?? [], lastShot, homePlayer?.id, ghost, {
    own: !isSpectator,
    pickable: canEditDraft
  });
  $: targetCells = buildCells(targetPlayer?.ships ?? [], targetPlayer?.incoming ?? [], lastShot, targetPlayer?.id, null, {
    own: false,
    pickable: false
  });

  /** @param {number} x @param {number} y */
  function shoot(x, y) {
    if (!isMyTurn || isLoading || !targetPlayer) return;
    if (blocked.has(y * SIZE + x)) return;
    if (targetPlayer.incoming.some((shot) => shot.x === x && shot.y === y)) return;
    onMove({ type: 'shoot', x, y });
  }

  // ---------- Mobile board switch ----------
  /** @type {'target' | 'home'} */
  let view = 'target';
  let lastTurnKey = '';
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let viewTimer;

  /**
   * @param {string} key
   * @param {string | null | undefined} shooterId
   * @param {string | null | undefined} homeId
   */
  function followTurn(key, shooterId, homeId) {
    if (key === lastTurnKey) return;
    const first = !lastTurnKey;
    lastTurnKey = key;
    if (!shooterId) return;
    // Show the sea that is being shot at: the shooter fires at the other player's board.
    /** @type {'target' | 'home'} */
    const next = shooterId === homeId ? 'target' : 'home';
    clearTimeout(viewTimer);
    if (first) view = next;
    else viewTimer = setTimeout(() => (view = next), 1100);
  }

  $: followTurn(`${game?.id}:${phase}:${game?.state.currentPlayerId}`, game?.state.currentPlayerId, homePlayer?.id);

  /** @param {'target' | 'home'} next */
  function showView(next) {
    clearTimeout(viewTimer);
    view = next;
  }

  onDestroy(() => clearTimeout(viewTimer));

  // ---------- Sounds for shots / end ----------
  let seenShotSeq = -1;
  let finishedFor = '';

  /** @param {SchiffeLastShot | null} shot */
  function announceShot(shot) {
    const seq = shot?.seq ?? 0;
    if (seenShotSeq === -1 || seq <= seenShotSeq) {
      seenShotSeq = seq;
      return;
    }
    seenShotSeq = seq;
    if (shot) playSound(shot.result === 'miss' ? 'miss' : 'hit');
  }

  $: announceShot(lastShot);

  $: if (game && isFinished && finishedFor !== game.id) {
    finishedFor = game.id;
    if (me) setTimeout(() => playSound(game?.state.winnerId === currentPlayerId ? 'win' : 'lose'), 450);
  }

  // ---------- Status line ----------
  /**
   * @param {string} phaseName
   * @param {boolean} finished
   * @param {boolean} myTurn
   * @param {SchiffeLastShot | null} shot
   * @param {SchiffePlayer | null} self
   * @param {SchiffePlayer | null} rival
   * @param {string} turnName
   * @param {number} placedCount
   * @param {number} fleetSize
   * @param {string} stage
   * @param {string} hint
   * @param {FleetEntry | null} held
   * @param {boolean} extraShot
   */
  function getStatusText(phaseName, finished, myTurn, shot, self, rival, turnName, placedCount, fleetSize, stage, hint, held, extraShot) {
    if (!game) return '';
    /** @param {string | null | undefined} id */
    const nameOf = (id) => game?.players.find((player) => player.id === id)?.name ?? 'Jemand';

    if (finished) {
      if (!self) return `${nameOf(game.state.winnerId)} hat die Seeschlacht gewonnen.`;
      return game.state.winnerId === self.id
        ? `Gewonnen! Die Flotte von ${rival?.name ?? 'deinem Gegner'} liegt auf dem Meeresgrund.`
        : `${nameOf(game.state.winnerId)} hat deine letzte Einheit versenkt.`;
    }

    if (phaseName === 'placement') {
      if (!self) return 'Beide Seiten stellen gerade ihre Flotten auf.';
      if (stage) return 'Flotte wird gemeldet …';
      if (self.ready) return rival?.ready ? 'Gleich geht es los.' : `Deine Flotte steht. Warte auf ${rival?.name ?? 'den Gegner'} …`;
      if (hint) return hint;
      if (placedCount === fleetSize) return 'Flotte komplett. Tippe auf „Bereit“, wenn alles passt.';
      if (held) return `${held.name} (${held.length}) setzen: Feld antippen.`;
      return `Stell deine Flotte auf: ${placedCount} von ${fleetSize} Schiffen gesetzt.`;
    }

    const where = shot ? coord(shot.x, shot.y) : '';
    const shooterIsMe = Boolean(self && shot?.shooterId === self.id);
    const shooterName = nameOf(shot?.shooterId);

    // Ohne Extraschuss (Einstellung extraShotOnHit = false) wechselt der Zug auch nach einem Treffer.
    const again = extraShot;

    if (!self) {
      if (!shot) return `${turnName} eröffnet das Feuer.`;
      if (shot.result === 'sunk') return `${shooterName} versenkt ${shipAcc(shot.shipName, 'der')} auf ${where}.${again ? '' : ` ${turnName} ist dran.`}`;
      if (shot.result === 'hit') return again ? `${shooterName} trifft auf ${where} und schießt nochmal.` : `${shooterName} trifft auf ${where}. ${turnName} ist dran.`;
      return `${shooterName} schießt auf ${where}: Wasser. ${turnName} ist dran.`;
    }

    if (myTurn) {
      if (shot && shooterIsMe && shot.result === 'sunk') return `${shot.shipName ?? 'Schiff'} versenkt! Du darfst nochmal.`;
      if (shot && shooterIsMe && shot.result === 'hit') return `Treffer auf ${where}! Du darfst nochmal.`;
      if (shot && !shooterIsMe && shot.result === 'sunk') return `${shooterName} hat ${shipAcc(shot.shipName, 'dein')} auf ${where} versenkt. Jetzt du – wähle ein Feld.`;
      if (shot && !shooterIsMe && shot.result === 'hit') return `${shooterName} trifft auf ${where}. Jetzt du – wähle ein Feld.`;
      if (shot && !shooterIsMe) return `${shooterName} schießt auf ${where}: Wasser. Jetzt du – wähle ein Feld.`;
      return 'Du eröffnest das Feuer – wähle ein Feld im gegnerischen Meer.';
    }

    if (shot && shooterIsMe && shot.result === 'sunk') return `${shot.shipName ?? 'Schiff'} versenkt! ${turnName} ist dran.`;
    if (shot && shooterIsMe && shot.result === 'hit') return `Treffer auf ${where}! ${turnName} ist dran.`;
    if (shot && shooterIsMe) return `${where}: Wasser. ${turnName} ist dran.`;
    if (shot && shot.result === 'sunk') return `${shooterName} hat ${shipAcc(shot.shipName, 'dein')} auf ${where} versenkt.`;
    if (shot && shot.result === 'hit') return again ? `${shooterName} trifft auf ${where} und schießt nochmal.` : `${shooterName} trifft auf ${where}.`;
    return `${turnName} zielt …`;
  }

  $: statusText = getStatusText(
    phase,
    isFinished,
    isMyTurn,
    lastShot,
    me,
    opponent,
    currentTurnName,
    placedShips.length,
    fleet.length,
    readyStage,
    notice,
    heldEntry,
    extraShot
  );

  /** @param {SchiffePlayer | null} player */
  function afloatCount(player) {
    return fleet.length - (player?.sunkCount ?? 0);
  }
</script>

{#if !game}
  <p class="ui-panel ui-muted">
    Schiffe versenken wird über eine Party gestartet, damit zwei Spieler verbunden sind.
  </p>
{:else}
  {#key game.id}
    <div class="sv">
      <header class="g-status">
        <p class="g-status-text" aria-live="polite">{statusText}</p>
        {#if isMyTurn}
          <span class="ui-chip ui-chip--accent">Du bist dran</span>
        {:else if phase === 'placement' && opponent}
          <span class="ui-chip sv-chip" class:ui-chip--positive={opponent.ready}>
            {#if opponent.ready}<Check size={14} aria-hidden="true" />{/if}
            <span class="sv-chip-name">{opponent.name}</span>{opponent.ready ? ' bereit' : ' stellt auf'}
          </span>
        {/if}
      </header>

      {#if phase === 'placement' && canEditDraft}
        <!-- ---------- Placement editor ---------- -->
        <div class="sv-place">
          <div class="sv-dock">
            <p class="sv-hint" id="sv-place-hint">
              {#if heldEntry}
                {heldEntry.name} ({heldEntry.length} Felder) setzen: Feld antippen. Platzierte Schiffe antippen, um sie neu zu setzen.
              {:else}
                Tippe ein Schiff an, um es zu verschieben.
              {/if}
            </p>
            <ul class="sv-ships" aria-label="Deine Schiffe">
              {#each fleet as entry (entry.id)}
                {@const placed = Boolean(draft[entry.id])}
                {@const held = heldId === entry.id && !placed}
                <li>
                  <button
                    type="button"
                    class="sv-ship"
                    class:is-held={held}
                    class:is-placed={placed}
                    aria-pressed={held}
                    on:click={() => selectShip(entry.id)}
                  >
                    <span class="sv-ship-pips" aria-hidden="true">
                      {#each Array(entry.length) as _, index (index)}<span class="sv-ship-pip"></span>{/each}
                    </span>
                    <span class="sv-ship-name">{entry.name}</span>
                    {#if placed}
                      <Check size={15} aria-hidden="true" class="sv-ship-check" />
                      <span class="sr-only">(platziert, antippen zum Versetzen)</span>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
            <div class="sv-tools">
              <button type="button" class="ui-btn sv-tool" on:click={rotate} aria-label={`Drehen, aktuell ${dir === 'h' ? 'waagerecht' : 'senkrecht'}`}>
                <RotateCw size={17} aria-hidden="true" />
                <span>{dir === 'h' ? 'Waagerecht' : 'Senkrecht'}</span>
              </button>
              <button type="button" class="ui-btn sv-tool" on:click={randomize} aria-label="Zufällig platzieren">
                <Shuffle size={17} aria-hidden="true" />
                <span>Zufällig</span>
              </button>
              {#if placedShips.length > 0}
                <button type="button" class="ui-btn ui-btn--ghost ui-btn--icon" on:click={clearDraft} aria-label="Alle Schiffe zurücknehmen" title="Alle Schiffe zurücknehmen">
                  <Undo2 size={18} aria-hidden="true" />
                </button>
              {/if}
            </div>
          </div>

          <section class="sv-place-board" aria-label="Deine Flotte">
            {#if me}
              <div class="sv-panel-head">
                <PlayerAvatar avatar={players.find((p) => p.id === me?.id)?.avatar ?? null} name={me.name} color={playerHexById(players, me.id)} size={32} />
                <h2 class="sv-panel-title">Deine Flotte</h2>
                <span class="sv-panel-meta ui-num">{placedShips.length}/{fleet.length}</span>
              </div>
            {/if}
            <SeaBoard
              cells={homeCells}
              ships={homeShips}
              label="Deine Flotte aufstellen. Pfeiltasten bewegen, Eingabe setzt, R dreht."
              interactive={canEditDraft}
              mode="place"
              onCellClick={handlePlaceClick}
              onCellHover={(x, y) => (hover = { x, y })}
              onLeave={() => (hover = null)}
              onRotate={rotate}
            />
          </section>

          <div class="sv-place-actions">
            <button type="button" class="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" on:click={confirmReady} disabled={!fleetComplete || isLoading}>
              {#if isLoading}<LoaderCircle size={18} class="sv-spin" aria-hidden="true" />{:else}<Check size={18} aria-hidden="true" />{/if}
              <span>Bereit</span>
            </button>
            {#if !fleetComplete}
              <p class="sv-sub">Noch {fleet.length - placedShips.length} {fleet.length - placedShips.length === 1 ? 'Schiff' : 'Schiffe'} übrig.</p>
            {/if}
          </div>
        </div>
      {:else if phase === 'placement'}
        <!-- ---------- Waiting for the other fleet ---------- -->
        <div class="sv-wait">
          <section class="sv-panel sv-panel--wait">
            <div class="sv-panel-head">
              {#if homePlayer}
                <PlayerAvatar avatar={players.find((p) => p.id === homePlayer?.id)?.avatar ?? null} name={homePlayer.name} color={playerHexById(players, homePlayer.id)} size={32} />
              {/if}
              <h2 class="sv-panel-title">{isSpectator ? homePlayer?.name ?? 'Spieler 1' : 'Deine Flotte'}</h2>
              <span class="sv-panel-meta">{homePlayer?.ready ? 'bereit' : 'stellt auf'}</span>
            </div>
            {#if isSpectator}
              <div class="sv-fog" aria-hidden="true">
                {#each game.players as player (player.id)}
                  <p>{player.name}: {player.ready ? 'bereit' : player.placed ? 'Flotte steht, noch nicht bereit' : 'stellt auf'}</p>
                {/each}
              </div>
            {:else}
              <SeaBoard cells={homeCells} ships={homeShips} label="Deine Flotte" />
            {/if}
          </section>
          <div class="sv-wait-note" role="status">
            {#if readyStage || isLoading}
              <LoaderCircle size={20} class="sv-spin" aria-hidden="true" />
              <p>Flotte wird gemeldet …</p>
            {:else}
              {#if opponent}
                <PlayerAvatar avatar={players.find((p) => p.id === opponent?.id)?.avatar ?? null} name={opponent.name} color={playerHexById(players, opponent.id)} size={32} />
              {:else}
                <span class="sv-wait-dot" aria-hidden="true"></span>
              {/if}
              <p>
                {#if isSpectator}
                  Die Schlacht beginnt, sobald beide bereit sind.
                {:else}
                  {opponent?.name ?? 'Dein Gegner'} {opponent?.placed ? 'prüft noch die Aufstellung' : 'stellt noch die Flotte auf'}. Wer anfängt, wird ausgelost.
                {/if}
              </p>
            {/if}
          </div>
        </div>
      {:else}
        <!-- ---------- Battle / finished ---------- -->
        <div class="g-segment sv-tabs" role="tablist" aria-label="Spielfeld wählen">
          <button
            type="button"
            role="tab"
            id="sv-tab-target"
            aria-controls="sv-panel-target"
            aria-selected={view === 'target'}
            class="g-segment-btn sv-tab"
            class:is-on={view === 'target'}
            class:is-live={!isFinished && game.state.currentPlayerId === homePlayer?.id}
            on:click={() => showView('target')}
          >
            <span class="sv-tab-name">{isSpectator ? targetPlayer?.name : 'Gegner'}</span>
            <span class="sv-tab-count">{afloatCount(targetPlayer)}/{fleet.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="sv-tab-home"
            aria-controls="sv-panel-home"
            aria-selected={view === 'home'}
            class="g-segment-btn sv-tab"
            class:is-on={view === 'home'}
            class:is-live={!isFinished && game.state.currentPlayerId === targetPlayer?.id}
            on:click={() => showView('home')}
          >
            <span class="sv-tab-name">{isSpectator ? homePlayer?.name : 'Deine Flotte'}</span>
            <span class="sv-tab-count">{afloatCount(homePlayer)}/{fleet.length}</span>
          </button>
        </div>

        <div class="sv-boards">
          <section
            class="sv-panel sv-panel--target"
            class:is-shown={view === 'target'}
            class:is-active={isMyTurn}
            id="sv-panel-target"
            aria-labelledby="sv-title-target"
          >
            <div class="sv-panel-head">
              {#if targetPlayer}
                <PlayerAvatar avatar={players.find((p) => p.id === targetPlayer?.id)?.avatar ?? null} name={targetPlayer.name} color={playerHexById(players, targetPlayer.id)} size={32} />
              {/if}
              <h2 class="sv-panel-title" id="sv-title-target">
                {isSpectator ? `Meer von ${targetPlayer?.name ?? ''}` : `Meer von ${targetPlayer?.name ?? 'Gegner'}`}
              </h2>
              {#if isMyTurn}
                <span class="sv-panel-meta sv-panel-meta--turn">{isLoading ? 'Schuss …' : 'Ziel wählen'}</span>
              {/if}
            </div>
            <SeaBoard
              cells={targetCells}
              ships={targetPlayer?.ships ?? []}
              label={isSpectator ? `Meer von ${targetPlayer?.name ?? ''}` : 'Gegnerisches Meer – Feld wählen zum Schießen'}
              interactive={isMyTurn && !isLoading}
              mode="target"
              onCellClick={shoot}
            />
            <FleetStatus {fleet} ships={targetPlayer?.ships ?? []} label={isSpectator ? `Flotte ${targetPlayer?.name ?? ''}` : 'Gegnerische Flotte'} />
          </section>

          <section
            class="sv-panel sv-panel--home"
            class:is-shown={view === 'home'}
            class:is-active={!isFinished && !isSpectator && game.state.currentPlayerId === targetPlayer?.id}
            id="sv-panel-home"
            aria-labelledby="sv-title-home"
          >
            <div class="sv-panel-head">
              {#if homePlayer}
                <PlayerAvatar avatar={players.find((p) => p.id === homePlayer?.id)?.avatar ?? null} name={homePlayer.name} color={playerHexById(players, homePlayer.id)} size={32} />
              {/if}
              <h2 class="sv-panel-title" id="sv-title-home">{isSpectator ? `Meer von ${homePlayer?.name ?? ''}` : 'Deine Flotte'}</h2>
              {#if !isSpectator && !isFinished && game.state.currentPlayerId === targetPlayer?.id}
                <span class="sv-panel-meta">{targetPlayer?.name} zielt</span>
              {/if}
            </div>
            <SeaBoard cells={homeCells} ships={homeShips} label={isSpectator ? `Meer von ${homePlayer?.name ?? ''}` : 'Deine Flotte'} />
            <FleetStatus {fleet} ships={homePlayer?.ships ?? []} own={!isSpectator} label={isSpectator ? `Flotte ${homePlayer?.name ?? ''}` : 'Deine Flotte'} />
          </section>
        </div>

        <ul class="sv-legend" aria-label="Legende">
          <li><span class="sv-key sv-key--miss" aria-hidden="true"></span>Wasser</li>
          <li><span class="sv-key sv-key--hit" aria-hidden="true"></span>Treffer</li>
          <li><span class="sv-key sv-key--sunk" aria-hidden="true"></span>Versenkt</li>
          <li><span class="sv-key sv-key--last" aria-hidden="true"></span>Letzter Schuss</li>
          {#if terrain.length}<li><span class="sv-key sv-key--land" aria-hidden="true"></span>Land – hier liegt nichts, hierhin wird nicht geschossen</li>{/if}
        </ul>
      {/if}
    </div>
  {/key}
{/if}

<style>
  /* Rahmen über die Design-Tokens (DESIGN.md); das Meer behält seine eigenen Farben. */
  .sv {
    --sv-sea: #d9eaf2;
    --sv-gridline: rgb(255 255 255 / 0.95);
    --sv-sea-hover: #c3dde9;
    --sv-hull: #4a6273;
    --sv-hull-hover: #31495a;
    --sv-hull-sunk: #1b2833;
    --sv-hit: #d43f27;
    --sv-hit-bg: #f8d8cf;
    --sv-hit-on-sunk: #ff8f78;
    --sv-miss: #5f8197;
    --sv-last: #0f172a;
    --sv-bad: #dc2626;
    --sv-bad-soft: rgb(220 38 38 / 0.32);
    --sv-focus: var(--accent-main);
    --sv-aim: var(--accent-main);
    --sv-ghost: color-mix(in srgb, var(--accent-main) 34%, transparent);

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
  }

  :global(html[data-theme='dark']) .sv {
    --sv-sea: #14324a;
    --sv-gridline: rgb(8 15 29 / 0.85);
    --sv-sea-hover: #1b4260;
    --sv-hull: #8ea6b8;
    --sv-hull-hover: #b4c7d6;
    --sv-hull-sunk: #050b11;
    --sv-hit: #ff6b52;
    --sv-hit-bg: #4a2420;
    --sv-hit-on-sunk: #ff7a62;
    --sv-miss: #7f9bb0;
    --sv-last: #f1f5f9;
    --sv-bad: #f87171;
    --sv-bad-soft: rgb(248 113 113 / 0.32);
    --sv-focus: var(--accent-text);
    --sv-aim: var(--accent-text);
    --sv-ghost: color-mix(in srgb, var(--accent-text) 30%, transparent);
  }

  /* ---------- 1. Statuszeile (gleich wie Skyjo / Tic Tac Toe) ---------- */
  .g-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .g-status-text {
    margin: 0;
    min-width: 0;
    font-size: 1rem;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text);
    text-wrap: balance;
  }

  .g-status :global(.ui-chip) {
    flex-shrink: 0;
  }

  .sv-chip {
    max-width: 11rem;
  }

  .sv-chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------- Segment-Umschalter (gleich wie Tauschen/Aufdecken in Skyjo) ---------- */
  .g-segment {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius-control);
    background: var(--surface);
  }

  .g-segment-btn {
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }

  .g-segment-btn.is-on {
    background: var(--raised);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .g-segment-btn:active {
    transform: scale(0.98);
  }

  .g-segment-btn:focus-visible,
  .sv-ship:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .sv :global(.sv-spin) {
    animation: sv-spin 900ms linear infinite;
  }

  @keyframes sv-spin {
    to { transform: rotate(360deg); }
  }

  /* ---------- Aufstellen ---------- */
  .sv-place {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    grid-template-areas:
      'dock'
      'board'
      'actions';
  }

  .sv-dock {
    grid-area: dock;
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
  }

  .sv-place-board {
    grid-area: board;
    display: grid;
    gap: 8px;
    min-width: 0;
    background: var(--surface);
    border-radius: var(--radius-card);
    padding: 10px;
  }

  .sv-place-actions {
    grid-area: actions;
    display: grid;
    gap: 6px;
    justify-items: center;
  }

  .sv-hint,
  .sv-sub {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--muted);
  }

  .sv-ships {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sv-ship {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition: background-color 140ms ease, box-shadow 140ms ease;
  }

  .sv-ship:active {
    transform: scale(0.98);
  }

  .sv-ship.is-held {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .sv-ship.is-placed {
    color: var(--muted);
  }

  .sv-ship-pips {
    display: inline-flex;
    flex-shrink: 0;
    gap: 2px;
  }

  .sv-ship-pip {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--sv-hull);
  }

  .is-held .sv-ship-pip {
    background: var(--accent-main);
  }

  .sv-ship-name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sv-ship :global(.sv-ship-check) {
    flex-shrink: 0;
    color: var(--accent-text);
  }

  /* Handy: Schiffe als wischbarer Streifen, damit das Meer ohne Scrollen sichtbar bleibt. */
  @media (max-width: 767px) {
    .sv-hint {
      display: none;
    }

    .sv-ships {
      display: flex;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      padding: 2px;
      margin: -2px;
    }

    .sv-ships::-webkit-scrollbar {
      display: none;
    }

    .sv-ships li {
      flex: 0 0 auto;
      scroll-snap-align: start;
    }

    .sv-ship {
      width: auto;
      border-radius: var(--radius-control);
      padding: 0 14px;
    }

    .sv-ship-name {
      overflow: visible;
    }
  }

  .sv-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sv-tool {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 14px;
  }

  /* ---------- Bretter ---------- */
  .sv-panel {
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
    background: var(--surface);
    border-radius: var(--radius-card);
    padding: 10px;
    transition: box-shadow 160ms ease;
  }

  .sv-panel.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .sv-panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }

  .sv-panel-title {
    flex: 1;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .sv-panel-meta {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted);
  }

  .sv-panel-meta--turn {
    color: var(--accent-text);
    font-weight: 600;
  }

  /* ---------- Warten ---------- */
  .sv-wait {
    display: grid;
    gap: 12px;
  }

  .sv-panel--wait {
    width: 100%;
    max-width: 30rem;
    justify-self: center;
  }

  .sv-wait-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 30rem;
    justify-self: center;
    padding: 12px 16px;
    border-radius: var(--radius-inner);
    background: var(--surface);
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .sv-wait-note p {
    margin: 0;
  }

  .sv-wait-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--accent-main);
    animation: sv-pulse 1.4s ease-in-out infinite;
  }

  .sv-fog {
    display: grid;
    gap: 4px;
    padding: 16px;
    border-radius: var(--radius-inner);
    background: var(--sv-sea);
    font-size: 0.875rem;
  }

  .sv-fog p {
    margin: 0;
  }

  @keyframes sv-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  /* ---------- Schlacht ---------- */
  .sv-tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 0 12px;
  }

  .sv-tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sv-tab-count {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }

  /* Punkt markiert das Brett, auf das gerade geschossen wird. */
  .sv-tab.is-live::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 14px;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--accent-main);
  }

  .sv-boards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .sv-panel--target,
  .sv-panel--home {
    display: none;
  }

  .sv-panel.is-shown {
    display: grid;
  }

  .sv-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .sv-legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sv-key {
    position: relative;
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 2px;
    background: var(--sv-sea);
  }

  .sv-key--miss::after {
    content: '';
    position: absolute;
    inset: 34%;
    border-radius: 999px;
    background: var(--sv-miss);
  }

  .sv-key--hit {
    background: var(--sv-hit-bg);
  }

  .sv-key--sunk {
    background: var(--sv-hull-sunk);
  }

  .sv-key--hit::before,
  .sv-key--hit::after,
  .sv-key--sunk::before,
  .sv-key--sunk::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 18%;
    bottom: 18%;
    width: 3px;
    border-radius: 2px;
    background: var(--sv-hit);
    transform: translateX(-50%) rotate(45deg);
  }

  .sv-key--hit::after,
  .sv-key--sunk::after {
    transform: translateX(-50%) rotate(-45deg);
  }

  .sv-key--sunk::before,
  .sv-key--sunk::after {
    background: var(--sv-hit-on-sunk);
  }

  .sv-key--last {
    box-shadow: 0 0 0 2px var(--sv-last);
  }

  @media (hover: hover) and (pointer: fine) {
    .sv-ship:hover:not(.is-held) {
      background: var(--surface-2);
    }

    .g-segment-btn:hover:not(.is-on) {
      color: var(--text);
    }
  }

  /* ---------- Tablet / Desktop: beide Bretter nebeneinander ---------- */
  @media (min-width: 640px) {
    .sv { gap: 16px; margin-top: 16px; }
    .g-status-text { font-size: 1.0625rem; }
    .sv-panel,
    .sv-place-board { padding: 16px; }
  }

  @media (min-width: 768px) {
    .sv-tabs {
      display: none;
    }

    .sv-boards {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }

    .sv-panel--target,
    .sv-panel--home {
      display: grid;
    }

    .sv-place {
      grid-template-columns: minmax(0, 1fr) minmax(15rem, 18rem);
      grid-template-areas:
        'board dock'
        'board actions';
      grid-template-rows: auto 1fr;
      align-items: start;
      gap: 16px 20px;
      max-width: 52rem;
      width: 100%;
      justify-self: center;
    }

    .sv-place-actions {
      justify-items: stretch;
      align-self: start;
    }

    .sv-ships {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .sv-boards {
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
      gap: 20px;
    }

    .sv-panel { padding: 20px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sv-wait-dot,
    .sv :global(.sv-spin) {
      animation: none;
    }

    .g-segment-btn,
    .sv-ship,
    .sv-panel {
      transition: none;
    }
  }
  .sv-key--land {
    background: #8ccf5f;
    box-shadow: inset 0 0 0 2px #f2d79b;
  }
</style>
