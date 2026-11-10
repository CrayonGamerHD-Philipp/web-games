<script>
  import { Check, Undo2, X } from '@lucide/svelte';
  import BoardGrid from './BoardGrid.svelte';
  import Die from './Die.svelte';
  import Glyph from './Glyph.svelte';
  import PlayerSheet from './PlayerSheet.svelte';
  import { tick } from 'svelte';
  import { PALETTE, SPECIAL_LABELS, ROW_BONUS_LABELS } from './palette.js';
  import { COLORS } from '../board.js';
  import { JOKERS, SPECIALS, completedColorCount, selectableCells, validateCombo, validateSpecial } from '../rules.js';
  import { playerHexById } from '$lib/player-colors.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

  /** @typedef {import('../types').NochMalSession} Session */
  /** @typedef {import('../types').NochMalPlayer} Player */
  /** @typedef {import('../types').NochMalMove} Move */
  /** @typedef {import('../types').NochMalColor} Color */
  /** @typedef {import('../types').NochMalEvent} KreuzEvent */
  /** @typedef {import('../types').NochMalAchievement} Achievement */

  /** @type {Session | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: Move) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];

  $: void renderNonce;

  const sounds = { dice: '/sounds/dice1.mp3', mark: '/sounds/turn_card1.mp3', confirm: '/sounds/ping.mp3', notify: '/sounds/take_card1.mp3' };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  // ---- Lokaler Zug (local-first) ----
  // Pro Wurf: Farbe + Zahl, der Sonderwürfel oder beides. Jede Würfelwahl hat ihren eigenen Entwurf.
  /** @type {number | null} */
  let colorIdx = null;
  /** @type {number | null} */
  let numberIdx = null;
  let useSpecial = false;
  /** @type {Color | null} */
  let jokerColor = null;
  /** @type {number | null} */
  let jokerNumber = null;
  /** Kreuze für Farbe + Zahl. */
  /** @type {string[]} */
  let draft = [];
  /** Kreuze für die Sonderaktion. */
  /** @type {string[]} */
  let specialDraft = [];
  /** @type {string[]} */
  let bombDraft = [];
  let bombMode = false;
  /** Vom Spieler gewählt, was er gerade setzt; null = automatisch. */
  /** @type {'combo' | 'special' | null} */
  let manualMode = null;
  let rollKey = '';
  let lastSeq = -1;
  /** @type {{ id: number, text: string, tone: 'mine' | 'other' | 'neutral' }[]} */
  let toasts = [];
  let toastId = 0;
  /** Mitspieler, dessen Brett gerade im Fenster gezeigt wird. */
  /** @type {string | null} */
  let viewingId = null;
  /** @type {HTMLElement | null} */
  let viewerEl = null;
  /** @type {HTMLElement | null} */
  let viewerReturnFocus = null;

  $: state = game?.state ?? null;
  $: board = state?.board ?? null;
  $: extended = state?.mode === 'erweitert';
  $: roll = state?.roll ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: isActive = state?.activePlayerId === currentPlayerId;
  $: activePlayer = game?.players.find((player) => player.id === state?.activePlayerId) ?? null;
  $: advantage = Boolean(game && game.players.length > 1 && (state?.round ?? 0) >= 4);
  $: waitingForActive = Boolean(advantage && !isActive && !state?.activeChoice && !state?.activeSkipped);
  $: takenChoice = advantage && !isActive ? state?.activeChoice ?? null : null;
  $: myLock = me?.lockedChoice ?? null;
  // Vom aktiven Spieler genommene Würfel – als Werte, damit das Template sie reaktiv sieht.
  $: takenColor = takenChoice?.combo?.colorDieIndex ?? -1;
  $: takenNumber = takenChoice?.combo?.numberDieIndex ?? -1;
  $: canPlay = Boolean(isRunning && me && !me.confirmed && !isLoading);
  $: checked = new Set(me?.checkedCells ?? []);
  $: recent = new Set(me?.lastCells ?? []);

  // Neuer Wurf: alles zurücksetzen.
  $: if (roll && roll.id !== rollKey) {
    if (rollKey) playSound('dice');
    rollKey = roll.id;
    resetTurn();
  }
  // Festgelegte Wahl des aktiven Spielers übernehmen.
  $: if (myLock?.combo && (colorIdx !== myLock.combo.colorDieIndex || numberIdx !== myLock.combo.numberDieIndex)) {
    colorIdx = myLock.combo.colorDieIndex;
    numberIdx = myLock.combo.numberDieIndex;
    jokerColor = myLock.combo.color;
    jokerNumber = myLock.combo.number;
  }
  $: if (myLock && Boolean(myLock.special) !== useSpecial) useSpecial = Boolean(myLock.special);

  $: colorFace = roll && colorIdx !== null ? roll.colorDice[colorIdx] : null;
  $: numberFace = roll && numberIdx !== null ? roll.numberDice[numberIdx] : null;
  $: comboColor = colorFace === 'joker' ? jokerColor : /** @type {Color | null} */ (colorFace);
  $: comboNumber = numberFace === 'joker' ? jokerNumber : /** @type {number | null} */ (numberFace);
  $: jokerCost = (colorFace === 'joker' ? 1 : 0) + (numberFace === 'joker' ? 1 : 0);
  $: jokersLeft = JOKERS - (me?.usedJokers ?? 0);
  $: comboChosen = colorIdx !== null && numberIdx !== null;
  $: halfCombo = (colorIdx === null) !== (numberIdx === null);
  /** @type {{ color: Color, number: number } | null} */
  $: combo = comboChosen && comboColor && comboNumber ? { color: comboColor, number: comboNumber } : null;
  $: special = useSpecial ? roll?.specialDie ?? null : null;
  $: specialNeedsCells = Boolean(special && special !== 'heart');
  $: needsJoker = comboChosen && ((colorFace === 'joker' && !jokerColor) || (numberFace === 'joker' && !jokerNumber));
  $: afterCombo = new Set([...checked, ...draft]);
  $: afterSpecial = new Set([...afterCombo, ...specialDraft]);
  /** Was nimmt der nächste Tipp aufs Brett auf? */
  /** @type {'combo' | 'special' | 'bomb' | null} */
  $: editMode = bombMode
    ? 'bomb'
    : manualMode === 'combo' && combo
      ? 'combo'
      : manualMode === 'special' && specialNeedsCells
        ? 'special'
        : combo && draft.length < combo.number
          ? 'combo'
          : specialNeedsCells
            ? 'special'
            : combo
              ? 'combo'
              : null;
  $: selectable = board && canPlay && !waitingForActive
    ? computeSelectable({ mode: editMode, currentCombo: combo, currentSpecial: special, base: checked, withCombo: afterCombo, withSpecial: afterSpecial, comboCells: draft, specialCells: specialDraft, bombCells: bombDraft })
    : new Set();
  $: comboError = board && combo ? validateCombo(board, checked, combo.color, combo.number, draft) : '';
  $: specialError = board && special ? validateSpecial(board, afterCombo, special, specialDraft) : '';
  $: bombError = board && bombDraft.length ? validateSpecial(board, afterSpecial, 'bomb', bombDraft) : '';
  $: usesDice = comboChosen || Boolean(special);
  $: canSubmit = Boolean(
    canPlay && !waitingForActive && !needsJoker && !halfCombo &&
    !(combo && comboError) && !(special && specialError) && !bombError &&
    (usesDice || bombDraft.length)
  );
  $: mustLock = Boolean(canPlay && advantage && isActive && !myLock && usesDice && !needsJoker && !halfCombo && !draft.length && !specialDraft.length);
  $: noOption = Boolean(editMode === 'combo' && combo && !needsJoker && draft.length === 0 && selectable.size === 0);
  $: displayDraft = new Set([...draft, ...specialDraft, ...bombDraft]);
  $: focusMode = Boolean(selectable.size || draft.length || specialDraft.length || bombDraft.length);
  // halfCombo, colorIdx, jokerColor und bombDraft liest getStatus intern – hier stehen sie, damit Svelte neu rechnet.
  $: statusText = (void [halfCombo, colorIdx, jokerColor, bombDraft.length, waitingNames], getStatus(game, me, editMode, combo, special, draft, specialDraft, waitingForActive, needsJoker, noOption));
  $: waitingNames = game ? game.players.filter((player) => !player.confirmed && player.id !== currentPlayerId).map((player) => player.name) : [];
  $: score = me?.score ?? null;
  $: opponents = game ? game.players.filter((player) => player.id !== currentPlayerId) : [];
  $: colorRace = board && game ? buildColorRace(board, me, game, currentPlayerId) : [];
  $: people = Object.fromEntries((game?.players ?? []).map((player) => [player.id, { name: player.id === currentPlayerId ? 'Du' : player.name, color: playerHexById(players, player.id) }]));
  $: viewing = viewingId ? game?.players.find((player) => player.id === viewingId) ?? null : null;
  $: viewingRace = viewing && board && game ? buildColorRace(board, viewing, game, viewing.id) : [];
  $: handleEvent(state?.lastEvent ?? null);

  /**
   * Alle Abhängigkeiten kommen als Argument, damit Svelte die Hervorhebung bei jeder Änderung neu berechnet.
   * @param {{ mode: 'combo' | 'special' | 'bomb' | null, currentCombo: { color: Color, number: number } | null, currentSpecial: import('../types').NochMalSpecial | null, base: Set<string>, withCombo: Set<string>, withSpecial: Set<string>, comboCells: string[], specialCells: string[], bombCells: string[] }} input
   * @returns {Set<string>}
   */
  function computeSelectable({ mode, currentCombo, currentSpecial, base, withCombo, withSpecial, comboCells, specialCells, bombCells }) {
    if (!board || !mode) return new Set();
    if (mode === 'bomb') return selectableCells(board, withSpecial, bombCells, { kind: 'bonus-bomb' });
    if (mode === 'special' && currentSpecial) {
      const result = selectableCells(board, withCombo, specialCells, { kind: 'special', special: currentSpecial });
      for (const id of bombCells) result.delete(id);
      return result;
    }
    if (mode === 'combo' && currentCombo) {
      const result = selectableCells(board, base, comboCells, { kind: 'combo', color: currentCombo.color, number: currentCombo.number });
      for (const id of [...specialCells, ...bombCells]) result.delete(id);
      return result;
    }
    return new Set();
  }

  /** Ändert sich die Kombi, muss die Sonderaktion noch dazu passen – sonst beginnt sie neu. */
  function revalidateLater() {
    if (!board) return;
    const base = new Set([...checked, ...draft]);
    if (special && specialDraft.length && validateSpecial(board, base, special, specialDraft, { partial: true })) specialDraft = [];
    const withSpecial = new Set([...base, ...specialDraft]);
    if (bombDraft.length && validateSpecial(board, withSpecial, 'bomb', bombDraft, { partial: true })) bombDraft = [];
  }

  function resetTurn() {
    colorIdx = null;
    numberIdx = null;
    useSpecial = false;
    jokerColor = null;
    jokerNumber = null;
    draft = [];
    specialDraft = [];
    bombDraft = [];
    bombMode = false;
    manualMode = null;
  }

  /** @param {number} index */
  function pickColor(index) {
    if (!canPlay || myLock) return;
    colorIdx = colorIdx === index ? null : index;
    jokerColor = null;
    draft = [];
    manualMode = null;
    revalidateLater();
  }

  /** @param {number} index */
  function pickNumber(index) {
    if (!canPlay || myLock) return;
    numberIdx = numberIdx === index ? null : index;
    jokerNumber = null;
    draft = [];
    manualMode = null;
    revalidateLater();
  }

  function pickSpecial() {
    if (!canPlay || myLock) return;
    useSpecial = !useSpecial;
    specialDraft = [];
    manualMode = null;
    revalidateLater();
  }

  /** @param {Color} color */
  function chooseJokerColor(color) {
    jokerColor = color;
    draft = [];
    revalidateLater();
  }

  /** @param {number} value */
  function chooseJokerNumber(value) {
    jokerNumber = value;
    draft = [];
    revalidateLater();
  }

  /**
   * @param {string[]} list
   * @param {string} id
   * @param {(rest: string[]) => boolean} valid
   */
  function removeFrom(list, id, valid) {
    const rest = list.filter((cell) => cell !== id);
    return !rest.length || valid(rest) ? rest : [];
  }

  /** @param {string} id */
  function toggleCell(id) {
    if (!board || !canPlay) return;
    const currentBoard = board;
    // Ein Tipp auf ein schon gewähltes Feld nimmt es aus seinem Entwurf.
    if (bombDraft.includes(id)) {
      bombDraft = bombDraft.filter((cell) => cell !== id);
      return;
    }
    if (specialDraft.includes(id) && special) {
      const kind = special;
      specialDraft = kind === 'block' ? [] : removeFrom(specialDraft, id, (rest) => !validateSpecial(currentBoard, afterCombo, kind, rest, { partial: true }));
      revalidateLater();
      return;
    }
    if (draft.includes(id) && combo) {
      const current = combo;
      draft = removeFrom(draft, id, (rest) => !validateCombo(currentBoard, checked, current.color, current.number, rest, { partial: true }));
      revalidateLater();
      return;
    }
    if (!selectable.has(id)) return;
    if (editMode === 'bomb') bombDraft = [...bombDraft, id];
    else if (editMode === 'special' && special === 'block') {
      const cell = currentBoard.cells.find((candidate) => candidate.id === id);
      if (cell) specialDraft = currentBoard.blocks[cell.blockId].cells.filter((cellId) => !afterCombo.has(cellId));
    } else if (editMode === 'special') specialDraft = [...specialDraft, id];
    else if (editMode === 'combo') draft = [...draft, id];
    playSound('mark');
  }

  function undo() {
    if (editMode === 'bomb' && bombDraft.length) bombDraft = bombDraft.slice(0, -1);
    else if (editMode === 'special' && specialDraft.length) specialDraft = special === 'block' ? [] : specialDraft.slice(0, -1);
    else if (draft.length) {
      draft = draft.slice(0, -1);
      revalidateLater();
    } else if (specialDraft.length) specialDraft = specialDraft.slice(0, -1);
    else if (bombDraft.length) bombDraft = bombDraft.slice(0, -1);
  }

  /** @returns {import('../types').NochMalChoice} */
  function buildChoice() {
    /** @type {import('../types').NochMalChoice} */
    const choice = { combo: null, special: Boolean(special) };
    if (colorIdx !== null && numberIdx !== null) {
      choice.combo = { colorDieIndex: colorIdx, numberDieIndex: numberIdx };
      if (colorFace === 'joker' && jokerColor) choice.combo.color = jokerColor;
      if (numberFace === 'joker' && jokerNumber) choice.combo.number = jokerNumber;
    }
    return choice;
  }

  function lockChoice() {
    if (!mustLock) return;
    onMove({ type: 'lock-choice', choice: buildChoice() });
  }

  function submit() {
    if (!canSubmit) return;
    playSound('confirm');
    onMove({ type: 'submit-turn', choice: buildChoice(), cellIds: draft, specialCellIds: specialDraft, bonusBombCells: bombDraft });
  }

  function skip() {
    if (!canPlay) return;
    onMove({ type: 'skip-turn' });
  }

  /**
   * @param {Session | null} session
   * @param {Player | null} player
   * @param {'combo' | 'special' | 'bomb' | null} mode
   * @param {{ color: Color, number: number } | null} currentCombo
   * @param {import('../types').NochMalSpecial | null} currentSpecial
   * @param {string[]} cells
   * @param {string[]} specialCells
   * @param {boolean} waiting
   * @param {boolean} joker
   * @param {boolean} nothing
   */
  function getStatus(session, player, mode, currentCombo, currentSpecial, cells, specialCells, waiting, joker, nothing) {
    if (!session) return '';
    if (session.status === 'finished') return 'Spielende – alle Felder sind gewertet.';
    if (!player) return `Du schaust zu. ${activePlayer?.name ?? 'Jemand'} ist aktiv.`;
    if (player.confirmed) return waitingNames.length ? `Erledigt. Noch dran: ${waitingNames.join(', ')}.` : 'Erledigt.';
    if (waiting) return `Warte, bis ${activePlayer?.name ?? 'der aktive Spieler'} Würfel nimmt. Du darfst danach aus dem Rest wählen.`;
    if (joker) return colorFace === 'joker' && !jokerColor ? 'Welche Farbe soll der Joker sein?' : 'Welche Zahl soll der Joker sein?';
    if (mode === 'bomb') return `Bonusbombe: bis zu 4 Felder in einem 2×2-Feld (${bombDraft.length} von 4).`;
    if (!currentCombo && !currentSpecial) {
      if (halfCombo) return colorIdx === null ? 'Wähle noch einen Farbwürfel.' : 'Wähle noch einen Zahlenwürfel.';
      const options = extended && player.specialTokens > 0 ? 'Farbe und Zahl, den Sonderwürfel oder beides' : 'eine Farbe und eine Zahl';
      return isActive && advantage ? `Du bist aktiv: Nimm ${options}. Die anderen wählen danach aus dem Rest.` : `Wähle ${options}.`;
    }
    if (halfCombo) return colorIdx === null ? 'Wähle noch einen Farbwürfel – oder nimm den anderen wieder weg.' : 'Wähle noch einen Zahlenwürfel – oder nimm den anderen wieder weg.';
    const extra = currentCombo && currentSpecial ? (currentSpecial === 'heart' ? ' Das Herz kommt beim Bestätigen dazu.' : ' Danach: Sonderaktion.') : '';
    if (mode === 'special' && currentSpecial) {
      const done = currentCombo ? `Farbe + Zahl fertig. ` : '';
      return `${done}${SPECIALS[currentSpecial].name}: ${SPECIALS[currentSpecial].hint} (${specialCells.length} gesetzt)`;
    }
    if (currentCombo) {
      if (nothing) return `Mit ${currentCombo.number} × ${PALETTE[currentCombo.color].name} passt gerade nichts. Wähle anders oder setze aus.`;
      if (mode === 'combo' && cells.length > 0 && cells.length < currentCombo.number && selectable.size === 0) return 'Von hier geht es nicht weiter. Nimm mit „Zurück“ Felder weg und beginne woanders.';
      const word = currentCombo.number === 1 ? 'Feld' : 'Felder';
      return `Kreuze ${currentCombo.number} ${word} in ${PALETTE[currentCombo.color].name} an – ${cells.length} von ${currentCombo.number}.${extra}`;
    }
    if (currentSpecial === 'heart') return 'Herz: Dein Bonus für jede fertige Spalte steigt um 1. Bestätige.';
    return '';
  }

  /**
   * @param {import('../types').NochMalBoard} currentBoard
   * @param {Player | null} player
   * @param {Session} session
   * @param {string} viewerId aus wessen Sicht (du oder ein Mitspieler)
   */
  function buildColorRace(currentBoard, player, session, viewerId) {
    const mine = new Set(player?.checkedCells ?? []);
    return COLORS.map((color) => {
      const total = currentBoard.cells.filter((cell) => cell.color === color).length;
      const done = currentBoard.cells.filter((cell) => cell.color === color && mine.has(cell.id)).length;
      const claim = session.state.claims.colors[color];
      const firstNames = claim.first.map((id) => (id === currentPlayerId ? 'Du' : session.players.find((candidate) => candidate.id === id)?.name ?? '')).filter(Boolean);
      const mineState = claim.first.includes(viewerId) ? 'first' : claim.normal.includes(viewerId) ? 'later' : null;
      return { color, total, done, firstNames, mineState };
    });
  }

  /** @param {KreuzEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    if (isFirst || !event || !board) return;
    for (const achievement of event.achievements) pushToast(achievement);
  }

  /** @param {Achievement} achievement */
  function pushToast(achievement) {
    if (!board || !game) return;
    const mine = achievement.playerIds.includes(currentPlayerId);
    if (!mine && !achievement.first) return;
    const names = achievement.playerIds.map((id) => (id === currentPlayerId ? 'Du' : game?.players.find((player) => player.id === id)?.name ?? '?'));
    const what = achievement.kind === 'column'
      ? `Spalte ${board.letters[achievement.index]}`
      : achievement.kind === 'row'
        ? `Zeile ${achievement.index + 1}`
        : `Alle ${PALETTE[achievement.color ?? 'lime'].name}`;
    const who = names.join(' & ');
    const bonus = achievement.bonus ? ` · Bonus: ${ROW_BONUS_LABELS[achievement.bonus]}` : '';
    const later = achievement.kind === 'row' ? `${what} voll – keine Punkte mehr${bonus}` : `${what} voll – +${achievement.points}`;
    const text = achievement.first ? `${what} voll – ${who} zuerst, +${achievement.points}${bonus}` : later;
    const id = ++toastId;
    toasts = [...toasts.slice(-3), { id, text, tone: mine ? 'mine' : 'other' }];
    playSound('notify');
    setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
    }, 5200);
  }

  /** @param {number} id */
  function dismissToast(id) {
    toasts = toasts.filter((toast) => toast.id !== id);
  }

  /** @param {keyof typeof sounds} name */
  function playSound(name) {
    if (typeof Audio === 'undefined') return;
    let audio = audioCache.get(name);
    if (!audio) {
      audio = new Audio(sounds[name]);
      audio.preload = 'metadata';
      audioCache.set(name, audio);
    }
    let volume = 0.85;
    try {
      const stored = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
      if (Number.isFinite(stored)) volume = Math.max(0, Math.min(1, stored));
    } catch {}
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }

  /** @param {string} id */
  async function openViewer(id) {
    viewerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    viewingId = id;
    await tick();
    viewerEl?.querySelector('button')?.focus();
  }

  function closeViewer() {
    if (!viewingId) return;
    viewingId = null;
    const target = viewerReturnFocus;
    viewerReturnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleViewerKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
      return;
    }
    if (event.key !== 'Tab' || !viewerEl) return;
    const focusables = Array.from(viewerEl.querySelectorAll('button'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** @param {string} id */
  function avatarOf(id) {
    return players.find((player) => player.id === id)?.avatar ?? null;
  }

  /** @param {Player} player */
  function playerStatus(player) {
    if (!isRunning) return `${player.score.total} Punkte`;
    if (player.confirmed) return player.skipped ? 'setzt aus' : 'fertig';
    if (player.id === state?.activePlayerId) return 'aktiv';
    return 'wählt';
  }

  /** @param {import('../types').NochMalColorFace} face @param {number} index @param {boolean} taken */
  function colorDieLabel(face, index, taken) {
    const name = face === 'joker' ? 'Farbjoker' : PALETTE[face].name;
    return `Farbwürfel ${index + 1}: ${name}${taken ? ', genommen' : ''}`;
  }

  /** @param {import('../types').NochMalNumberFace} face @param {number} index @param {boolean} taken */
  function numberDieLabel(face, index, taken) {
    const name = face === 'joker' ? 'Zahlenjoker' : String(face);
    return `Zahlenwürfel ${index + 1}: ${name}${taken ? ', genommen' : ''}`;
  }
</script>

{#if !game || !state || !board || !roll}
  <div class="ui-alert" role="status">Verrückte Kreuze wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="kz" class:is-extended={extended} class:is-finished={!isRunning}>
    <header class="kz-top">
      <div class="kz-top-text" aria-live="polite" aria-atomic="true">
        <p class="kz-status">{statusText}</p>
        <p class="kz-sub">
          Wurf {state.round}{state.maxRounds < 100 ? ` von ${state.maxRounds}` : ''} · {extended ? 'Erweitert' : 'Klassisch'} · {board.cols}×{board.rows} · Startspalte {board.letters[board.startCol]}
          {#if advantage && isRunning}· {isActive ? 'du nimmst' : `${activePlayer?.name ?? 'Der aktive Spieler'} nimmt`} zuerst{/if}
        </p>
      </div>
      {#if isRunning && isActive && me}<span class="ui-chip ui-chip--accent">Du bist aktiv</span>{/if}
    </header>

    <div class="kz-layout">
      <!-- Würfel und Zug -->
      {#if isRunning}
      <section class="kz-dice ui-panel" aria-label="Würfel und Zug">
        <div class="kz-dice-rows">
          <div class="kz-dice-row" role="group" aria-label="Farbwürfel">
            {#each roll.colorDice as face, index (index)}
              <Die
                kind="color"
                {face}
                selected={colorIdx === index}
                taken={index === takenColor}
                disabled={!canPlay || waitingForActive || index === takenColor || Boolean(myLock) || (face === 'joker' && jokersLeft < 1)}
                label={colorDieLabel(face, index, index === takenColor)}
                onPick={() => pickColor(index)}
              />
            {/each}
          </div>
          <div class="kz-dice-row" role="group" aria-label="Zahlenwürfel">
            {#each roll.numberDice as face, index (index)}
              <Die
                kind="number"
                {face}
                selected={numberIdx === index}
                taken={index === takenNumber}
                disabled={!canPlay || waitingForActive || index === takenNumber || Boolean(myLock) || (face === 'joker' && jokersLeft < 1)}
                label={numberDieLabel(face, index, index === takenNumber)}
                onPick={() => pickNumber(index)}
              />
            {/each}
          </div>
          {#if extended && roll.specialDie}
            <div class="kz-dice-row kz-dice-row--special">
              <Die
                kind="special"
                face={roll.specialDie}
                selected={useSpecial}
                taken={Boolean(takenChoice?.special)}
                disabled={!canPlay || waitingForActive || (me?.specialTokens ?? 0) < 1 || Boolean(takenChoice?.special) || Boolean(myLock)}
                label={`Sonderwürfel: ${SPECIAL_LABELS[roll.specialDie].name}${(me?.specialTokens ?? 0) < 1 ? ', keine Marke' : ''}`}
                onPick={pickSpecial}
              />
              <span class="kz-special-text">
                <strong>{SPECIAL_LABELS[roll.specialDie].name}</strong>
                <span>{(me?.specialTokens ?? 0) > 0 ? `Zusätzlich oder allein · 1 Marke · du hast ${me?.specialTokens}` : 'Keine Marke – kreuze ein Würfelfeld an'}</span>
              </span>
            </div>
          {/if}
        </div>

        {#if canPlay && colorFace === 'joker' && !myLock}
          <div class="kz-joker" role="radiogroup" aria-label="Farbe für den Joker">
            {#each COLORS as color (color)}
              <button
                type="button"
                class="kz-joker-color"
                style={`--fill:${PALETTE[color].fill}`}
                class:is-on={jokerColor === color}
                role="radio"
                aria-checked={jokerColor === color}
                aria-label={PALETTE[color].name}
                on:click={() => chooseJokerColor(color)}
              ></button>
            {/each}
          </div>
        {/if}
        {#if canPlay && numberFace === 'joker' && !myLock}
          <div class="kz-joker" role="radiogroup" aria-label="Zahl für den Joker">
            {#each [1, 2, 3, 4, 5] as value (value)}
              <button type="button" class="kz-joker-num ui-num" class:is-on={jokerNumber === value} role="radio" aria-checked={jokerNumber === value} on:click={() => chooseJokerNumber(value)}>{value}</button>
            {/each}
          </div>
        {/if}
        {#if jokerCost > 0 && !myLock}
          <p class="kz-note">Kostet {jokerCost} {jokerCost === 1 ? 'Joker' : 'Joker'} · {jokersLeft} übrig</p>
        {/if}

        {#if combo && specialNeedsCells && canPlay && !waitingForActive}
          <div class="kz-modes" role="group" aria-label="Was setzt du gerade?">
            <button type="button" class="kz-mode" class:is-on={editMode === 'combo'} aria-pressed={editMode === 'combo'} on:click={() => { manualMode = 'combo'; bombMode = false; }}>
              <span class="kz-mode-swatch" style={`--fill:${PALETTE[combo.color].fill}`}></span>{combo.number} × {PALETTE[combo.color].name}
              <span class="kz-mode-count ui-num">{draft.length}/{combo.number}</span>
            </button>
            <button type="button" class="kz-mode" class:is-on={editMode === 'special'} aria-pressed={editMode === 'special'} on:click={() => { manualMode = 'special'; bombMode = false; }}>
              {#if special}<Glyph name={special} size={16} />{SPECIAL_LABELS[special].short}{/if}
              <span class="kz-mode-count ui-num">{specialDraft.length}</span>
            </button>
          </div>
        {:else if combo && draft.length > 0}
          <div class="kz-progress" aria-hidden="true">
            {#each Array(combo.number) as _, index (index)}
              <span class="kz-progress-dot" class:is-on={index < draft.length} style={`--fill:${PALETTE[combo.color].fill}`}></span>
            {/each}
          </div>
        {/if}

        {#if extended && me && me.bonusBombs > 0 && canPlay && !waitingForActive}
          <button type="button" class="kz-bomb-toggle" class:is-on={bombMode} aria-pressed={bombMode} on:click={() => { bombMode = !bombMode; }}>
            <Glyph name="bomb" size={18} />
            {bombMode ? 'Bonusbombe setzen – fertig?' : `Bonusbombe setzen (${me.bonusBombs})`}
          </button>
        {/if}

        <div class="kz-actions">
          {#if mustLock}
            <button type="button" class="ui-btn ui-btn--primary ui-btn--block" disabled={isLoading} on:click={lockChoice}>Würfel nehmen</button>
          {:else}
            <button type="button" class="ui-btn ui-btn--primary ui-btn--block" disabled={!canSubmit} on:click={submit}>
              <Check size={18} aria-hidden="true" />Bestätigen
            </button>
          {/if}
          <div class="kz-actions-row">
            <button type="button" class="ui-btn ui-btn--ghost" disabled={!canPlay || (!draft.length && !specialDraft.length && !bombDraft.length)} on:click={undo}><Undo2 size={16} aria-hidden="true" />Zurück</button>
            <button type="button" class="ui-btn ui-btn--ghost" disabled={!canPlay || (Boolean(myLock) && !noOption)} on:click={skip}>Aussetzen</button>
          </div>
        </div>
      </section>
      {/if}

      <!-- Brett -->
      <section class="kz-board-panel ui-panel" aria-label="Dein Spielfeld">
        <div class="kz-board-scroll touch-scroll-x">
          {#if me}
            <BoardGrid
              {board}
              {checked}
              draft={displayDraft}
              {selectable}
              {recent}
              claims={state.claims}
              playerId={currentPlayerId}
              {extended}
              {focusMode}
              columnHearts={me.columnHearts}
              {people}
              onCell={canPlay ? toggleCell : null}
            />
          {:else}
            <BoardGrid {board} claims={state.claims} {extended} {people} />
          {/if}
        </div>
        <p class="kz-legend">
          Durchgestrichen heißt: Das hat schon jemand zuerst geschafft. Du bekommst dann noch den farbig hinterlegten Wert{extended ? ' – bei Zeilen nur noch den Bonus' : ''}.
        </p>
        <ul class="kz-race" aria-label="Fortschritt je Farbe">
          {#each colorRace as entry (entry.color)}
            <li class="kz-race-item" class:is-first={entry.mineState === 'first'}>
              <span class="kz-race-head">
                <span class="kz-race-swatch" style={`--fill:${PALETTE[entry.color].fill}`}></span>
                <span class="kz-race-name">{PALETTE[entry.color].name}</span>
                <span class="kz-race-count ui-num">{entry.done}/{entry.total}</span>
              </span>
              <span class="kz-race-bar"><span class="kz-race-fill" style={`--fill:${PALETTE[entry.color].fill};width:${(entry.done / entry.total) * 100}%`}></span></span>
              <span class="kz-race-claim">
                {#if entry.mineState === 'first'}Du zuerst · +5
                {:else if entry.mineState === 'later'}Geschafft · +3
                {:else if entry.firstNames.length}{entry.firstNames.join(', ')} zuerst · noch +3
                {:else}Erster bekommt +5{/if}
              </span>
            </li>
          {/each}
        </ul>
      </section>

      <!-- Wertung und Mitspieler -->
      <aside class="kz-side-col">
        {#if me && score}
          <section class="ui-panel kz-score" aria-label="Deine Wertung">
            <PlayerSheet player={me} {extended} running={isRunning} />
          </section>
        {/if}

        {#if opponents.length}
          <section class="ui-panel kz-opps" aria-label="Mitspieler">
            <ul class="kz-opps-list">
              {#each opponents as player (player.id)}
                {@const active = isRunning && state.activePlayerId === player.id}
                <li>
                  <button type="button" class="kz-opp" class:is-active={active} class:is-done={isRunning && player.confirmed} aria-label={`Spielfeld von ${player.name} ansehen`} on:click={() => openViewer(player.id)}>
                  <div class="kz-opp-head">
                    <PlayerAvatar avatar={avatarOf(player.id)} name={player.name} color={playerHexById(players, player.id)} size={28} {active} />
                    <span class="kz-opp-meta">
                      <span class="kz-opp-name">{player.name}</span>
                      <span class="kz-opp-sub ui-num">{player.score.total} P. · {completedColorCount(board, new Set(player.checkedCells))}/2 Farben · {playerStatus(player)}</span>
                    </span>
                    {#if isRunning && player.confirmed}<span class="kz-opp-check"><Check size={16} aria-label="fertig" /></span>{/if}
                  </div>
                  <div class="kz-opp-board">
                    <BoardGrid {board} checked={new Set(player.checkedCells)} recent={new Set(player.lastCells)} compact />
                  </div>
                  <span class="kz-opp-open">Spielfeld ansehen</span>
                  </button>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </aside>
    </div>

    {#if !isRunning && state.roundScores.length}
      <section class="ui-panel kz-final" aria-label="Endwertung">
        <h3 class="ui-section-title">Endwertung</h3>
        <div class="kz-final-wrap touch-scroll-x">
          <table class="kz-final-table">
            <thead>
              <tr>
                <th scope="col">Name</th><th scope="col">Spalten</th>{#if extended}<th scope="col">Zeilen</th>{/if}<th scope="col">Farben</th>{#if extended}<th scope="col">Herzen</th>{/if}<th scope="col">Joker</th>{#if extended}<th scope="col">Marken</th>{/if}<th scope="col">Sterne</th><th scope="col">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {#each [...state.roundScores].sort((a, b) => b.score - a.score) as row (row.playerId)}
                <tr class:is-me={row.playerId === currentPlayerId}>
                  <th scope="row">{game.players.find((player) => player.id === row.playerId)?.name}</th>
                  <td>{row.breakdown.columns}</td>{#if extended}<td>{row.breakdown.rows}</td>{/if}<td>{row.breakdown.colors}</td>{#if extended}<td>{row.breakdown.hearts}</td>{/if}<td>+{row.breakdown.jokers}</td>{#if extended}<td>+{row.breakdown.tokens}</td>{/if}<td>{row.breakdown.stars}</td><td class="kz-final-total">{row.score}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    {#if viewing}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="ui-dialog-backdrop kz-viewer-backdrop" role="presentation" on:click|self={closeViewer}>
        <div
          bind:this={viewerEl}
          class="ui-dialog kz-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kz-viewer-title"
          tabindex="-1"
          on:keydown={handleViewerKeydown}
        >
          <header class="kz-viewer-head">
            <PlayerAvatar avatar={avatarOf(viewing.id)} name={viewing.name} color={playerHexById(players, viewing.id)} size={32} />
            <div class="kz-viewer-title-wrap">
              <h2 id="kz-viewer-title" class="kz-viewer-title">Spielfeld von {viewing.name}</h2>
              <p class="kz-viewer-sub">{playerStatus(viewing)} · {completedColorCount(board, new Set(viewing.checkedCells))}/2 Farben komplett</p>
            </div>
            <button type="button" class="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Schließen" on:click={closeViewer}><X size={18} aria-hidden="true" /></button>
          </header>
          <div class="kz-viewer-body">
            <div class="kz-viewer-board">
              <div class="kz-board-scroll touch-scroll-x">
                <BoardGrid
                  {board}
                  checked={new Set(viewing.checkedCells)}
                  recent={new Set(viewing.lastCells)}
                  claims={state.claims}
                  playerId={viewing.id}
                  {extended}
                  columnHearts={viewing.columnHearts}
                  people={{ ...people, [viewing.id]: { name: viewing.name, color: playerHexById(players, viewing.id) } }}
                />
              </div>
              <ul class="kz-race kz-race--compact" aria-label={`Fortschritt je Farbe von ${viewing.name}`}>
                {#each viewingRace as entry (entry.color)}
                  <li class="kz-race-item" class:is-first={entry.mineState === 'first'}>
                    <span class="kz-race-head">
                      <span class="kz-race-swatch" style={`--fill:${PALETTE[entry.color].fill}`}></span>
                      <span class="kz-race-name">{PALETTE[entry.color].name}</span>
                      <span class="kz-race-count ui-num">{entry.done}/{entry.total}</span>
                    </span>
                    <span class="kz-race-bar"><span class="kz-race-fill" style={`--fill:${PALETTE[entry.color].fill};width:${(entry.done / entry.total) * 100}%`}></span></span>
                  </li>
                {/each}
              </ul>
            </div>
            <div class="kz-viewer-sheet">
              <PlayerSheet player={viewing} {extended} running={isRunning} />
            </div>
          </div>
        </div>
      </div>
    {/if}

    <div class="kz-toasts" aria-live="polite">
      {#each toasts as toast (toast.id)}
        <div class="kz-toast" class:is-mine={toast.tone === 'mine'}>
          <span>{toast.text}</span>
          <button type="button" class="kz-toast-close" aria-label="Meldung schließen" on:click={() => dismissToast(toast.id)}><X size={14} aria-hidden="true" /></button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .kz {
    display: grid;
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  .kz-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .kz-top-text {
    min-width: 0;
  }

  .kz-status {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 650;
    text-wrap: balance;
  }

  .kz-sub {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  /* Raster: Würfel | Brett | Wertung. 19rem + 1fr + 19rem, 12px Abstand. */
  .kz-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'board' 'dice' 'side';
    gap: 12px;
    align-items: start;
  }

  .kz-dice {
    grid-area: dice;
  }

  .kz-board-panel {
    grid-area: board;
    min-width: 0;
    container-type: inline-size;
  }

  .kz-legend {
    margin: 10px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .kz-side-col {
    grid-area: side;
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  @media (min-width: 760px) {
    .kz-layout {
      grid-template-columns: 16.5rem minmax(0, 1fr);
      grid-template-areas: 'dice board' 'side side';
    }

    .kz-dice {
      position: sticky;
      top: 12px;
    }

    .kz-side-col {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  @media (min-width: 760px) {
    .kz.is-finished .kz-layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'board' 'side';
    }
  }

  @media (min-width: 1320px) {
    .kz-layout {
      grid-template-columns: 16.5rem minmax(0, 1fr) 17rem;
      grid-template-areas: 'dice board side';
    }

    .kz.is-finished .kz-layout {
      grid-template-columns: minmax(0, 1fr) 17rem;
      grid-template-areas: 'board side';
    }

    .kz-side-col {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* Handy: Würfel als Leiste am unteren Rand. */
  @media (max-width: 759px) {
    .kz-dice {
      position: sticky;
      bottom: 0;
      z-index: 5;
      --die-size: 2.75rem;
      padding: 12px;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
      box-shadow: 0 -8px 24px rgb(0 0 0 / 0.14);
      background: var(--raised);
    }

    .kz-dice-rows {
      grid-template-columns: auto auto;
      justify-content: center;
    }

    .kz-dice-row--special {
      grid-column: 1 / -1;
      justify-content: center;
    }

    .kz-special-text {
      display: none !important;
    }
  }

  .kz-dice-rows {
    display: grid;
    gap: 12px;
  }

  .kz-dice-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .kz-dice-row--special {
    align-items: center;
    gap: 12px;
  }

  .kz-special-text {
    display: grid;
    gap: 2px;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .kz-special-text strong {
    color: var(--text);
    font-size: 0.9375rem;
  }

  .kz-joker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .kz-joker-color {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: var(--fill);
    cursor: pointer;
  }

  .kz-joker-num {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }

  .kz-joker-color.is-on,
  .kz-joker-num.is-on {
    box-shadow: 0 0 0 3px var(--ground), 0 0 0 5px var(--accent-main);
  }

  .kz-joker-num.is-on {
    background: var(--accent-main);
    color: #fff;
  }

  .kz-note {
    margin: 8px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .kz-modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 12px;
  }

  .kz-mode {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 650;
    cursor: pointer;
  }

  .kz-mode.is-on {
    background: var(--accent-main);
    color: #fff;
  }

  .kz-mode:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .kz-mode-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--fill);
  }

  .kz-mode-count {
    opacity: 0.75;
  }

  .kz-progress {
    display: flex;
    gap: 6px;
    margin-top: 12px;
  }

  .kz-progress-dot {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--surface-2);
  }

  .kz-progress-dot.is-on {
    background: var(--fill);
  }

  .kz-bomb-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 40px;
    margin-top: 12px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font-weight: 600;
    cursor: pointer;
  }

  .kz-bomb-toggle.is-on {
    background: #2b2d33;
    color: #ffd36b;
  }

  .kz-actions {
    display: grid;
    gap: 8px;
    margin-top: 16px;
  }

  .kz-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .kz-board-scroll {
    overflow-x: auto;
    padding: 2px 2px 14px;
  }

  .kz-board-scroll :global(.kz-board) {
    margin: 0 auto;
  }

  /* Farbrennen */
  .kz-race {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 10px 14px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .kz-race-item {
    display: grid;
    gap: 5px;
  }

  .kz-race-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .kz-race-swatch {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    background: var(--fill);
  }

  .kz-race-count {
    margin-left: auto;
    color: var(--muted);
  }

  .kz-race-bar {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .kz-race-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--fill);
    transition: width 300ms ease;
  }

  .kz-race-claim {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .kz-race-item.is-first .kz-race-claim {
    color: var(--accent-text);
    font-weight: 600;
  }

  /* Wertung */
  /* Mitspieler */
  .kz-opps-list {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .kz-opps-list > li {
    display: block;
  }

  .kz-opp {
    display: grid;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--surface-2);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 140ms ease, background-color 140ms ease;
  }

  .kz-opp:hover {
    background: color-mix(in srgb, var(--accent-main) 10%, var(--surface-2));
  }

  .kz-opp:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .kz-opp-open {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent-text);
  }

  /* Fenster: Spielfeld eines Mitspielers */
  .kz-viewer-backdrop {
    z-index: 80;
  }

  .ui-dialog.kz-viewer {
    max-width: min(1180px, 100%);
    padding: 20px;
  }

  .kz-viewer-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .kz-viewer-title-wrap {
    flex: 1;
    min-width: 0;
  }

  .kz-viewer-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }

  .kz-viewer-sub {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .kz-viewer-body {
    display: grid;
    gap: 16px;
  }

  .kz-viewer-board {
    min-width: 0;
    container-type: inline-size;
  }

  @media (min-width: 900px) {
    .kz-viewer-body {
      grid-template-columns: minmax(0, 1fr) 15rem;
      align-items: start;
    }
  }

  .kz-race--compact {
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  }

  .kz-opp.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .kz-opp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .kz-opp-meta {
    display: grid;
    min-width: 0;
    flex: 1;
  }

  .kz-opp-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 650;
  }

  .kz-opp-sub {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .kz-opp-check {
    display: inline-flex;
    color: var(--positive);
  }

  .kz-opp-board {
    overflow-x: auto;
  }

  /* Endwertung */
  .kz-final-wrap {
    overflow-x: auto;
    margin-top: 8px;
  }

  .kz-final-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }

  .kz-final-table th,
  .kz-final-table td {
    padding: 6px 8px;
    text-align: right;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
  }

  .kz-final-table th[scope='row'],
  .kz-final-table thead th:first-child {
    text-align: left;
  }

  .kz-final-table thead th {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }

  .kz-final-table tr.is-me th {
    color: var(--accent-text);
  }

  .kz-final-total {
    font-weight: 750;
  }

  /* Meldungen: schwebend, nicht blockierend */
  .kz-toasts {
    position: fixed;
    right: 16px;
    top: 84px;
    z-index: 60;
    display: grid;
    gap: 8px;
    width: min(22rem, calc(100vw - 32px));
    pointer-events: none;
  }

  .kz-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 16px;
    border-radius: 14px;
    background: var(--raised);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
    pointer-events: auto;
    animation: kz-toast-in 220ms ease-out;
  }

  .kz-toast.is-mine {
    background: var(--accent-main);
    color: #fff;
  }

  .kz-toast span {
    flex: 1;
  }

  .kz-toast-close {
    display: inline-flex;
    padding: 4px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  @keyframes kz-toast-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
  }

  @media (max-width: 759px) {
    .kz-toasts {
      top: auto;
      bottom: 220px;
      right: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kz-toast {
      animation: none;
    }

    .kz-race-fill {
      transition: none;
    }
  }
</style>
