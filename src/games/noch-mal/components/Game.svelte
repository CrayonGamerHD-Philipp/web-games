<script lang="ts">
  import { Check, LoaderCircle, RotateCcw, Star, X } from '@lucide/svelte';
  import { onDestroy, tick } from 'svelte';
  import { initials, playerHexById } from '$lib/player-colors.js';
  import { bottomScore, cells, jokerCount, letters, rows, topScore } from '../data/board';
  import type { NochMalColor, NochMalColorDie, NochMalNumberDie, NochMalPlayer, NochMalSession } from '../types';

  export let game: NochMalSession | null = null;
  export let currentPlayerId = '';
  export let isLoading = false;
  export let onMove: (move: Record<string, unknown>) => void = () => {};
  export let renderNonce = 0;
  export let players: { id: string; name: string; color?: string }[] = [];

  let colorDieIndex: number | null = null;
  let numberDieIndex: number | null = null;
  let jokerColor: NochMalColor = 'lime';
  let jokerNumber = 1;
  let lastRollId = '';
  // Der Zug wird lokal zusammengestellt (sofortiges Feedback) und erst beim Bestätigen gesendet.
  let draft: string[] = [];
  let draftKey = '';
  let ownSection: HTMLElement | null = null;

  // Auf dem Handy liegt das Blatt unter der Würfelablage: nach der Würfelwahl sanft dorthin scrollen.
  function revealBoard() {
    if (!ownSection || typeof window === 'undefined') return;
    const top = ownSection.getBoundingClientRect().top;
    if (top < window.innerHeight * 0.45) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: window.scrollY + top - 72, behavior: reduce ? 'auto' : 'smooth' });
  }
  let lastFinishedGameId = '';
  let claimsInitializedForGameId = '';
  let knownClaimKeys = new Set<string>();
  let achievementQueue: Achievement[] = [];
  let activeAchievement: Achievement | null = null;
  let achievementTimer: ReturnType<typeof setTimeout> | null = null;
  let boardScrollLeft = 0;
  let showBoardScrollLeftFade = false;
  let showBoardScrollRightFade = false;
  let achievementCloseButton: HTMLButtonElement | null = null;
  let focusBeforeAchievement: HTMLElement | null = null;

  type Achievement = {
    key: string;
    kind: 'column' | 'color';
    color?: NochMalColor;
    playerId: string;
    playerName: string;
    title: string;
    detail: string;
    points: number;
  };

  type SoundName = 'dice' | 'select' | 'mark' | 'confirm' | 'win' | 'lose' | 'notify';

  const soundSources: Record<SoundName, string> = {
    dice: '/sounds/dice1.mp3',
    select: '/sounds/select1.mp3',
    mark: '/sounds/turn_card1.mp3',
    confirm: '/sounds/ping.mp3',
    win: '/sounds/win1.mp3',
    lose: '/sounds/lose1.mp3',
    notify: '/sounds/take_card1.mp3'
  };

  const audioCache = new Map<SoundName, HTMLAudioElement>();

  const colors: NochMalColor[] = ['lime', 'yellow', 'blue', 'pink', 'peach'];
  const colorNames: Record<NochMalColor, string> = {
    lime: 'Grün',
    yellow: 'Gelb',
    blue: 'Blau',
    pink: 'Pink',
    peach: 'Orange'
  };
  const colorSymbolClass: Record<NochMalColor, string> = {
    lime: 'rotate-45 rounded-[2px]',
    yellow: 'rounded-full',
    blue: 'rounded-[2px]',
    pink: 'rotate-45 rounded-sm before:absolute before:left-1/2 before:top-1/2 before:h-1.5 before:w-5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-current after:absolute after:left-1/2 after:top-1/2 after:h-5 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-current',
    peach: 'rotate-45 rounded-md'
  };
  const colorClass: Record<NochMalColor, string> = {
    lime: 'bg-[#b8d86e] text-[#365b18]',
    yellow: 'bg-[#ffd85c] text-[#6e5000]',
    blue: 'bg-[#8fcbed] text-[#0f567b]',
    pink: 'bg-[#cf3f79] text-[#fdf2f8]',
    peach: 'bg-[#e79a4e] text-[#5d2a0d]'
  };
  const noticeColorClass: Record<NochMalColor, string> = {
    lime: 'text-lime-700',
    yellow: 'text-amber-600',
    blue: 'text-sky-700',
    pink: 'text-pink-700',
    peach: 'text-orange-700'
  };

  $: void renderNonce;
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: opponents = game?.players.filter((player) => player.id !== currentPlayerId) ?? [];
  $: roll = game?.state.roll ?? null;
  $: if (roll?.id && roll.id !== lastRollId) {
    if (lastRollId) playSound('dice');
    lastRollId = roll.id;
    colorDieIndex = null;
    numberDieIndex = null;
    jokerColor = 'lime';
    jokerNumber = 1;
    draft = [];
  }
  // Vom Server festgelegte Würfel (Startspieler im Vorteil) übernehmen.
  $: diceLocked = Boolean(me && me.selectedColorDieIndex !== null && me.selectedNumberDieIndex !== null && !me.confirmed);
  $: if (diceLocked && me) {
    colorDieIndex = me.selectedColorDieIndex;
    numberDieIndex = me.selectedNumberDieIndex;
  }
  $: if (me?.confirmed && draft.length) draft = [];
  $: if (game?.status === 'finished' && game.id !== lastFinishedGameId) {
    lastFinishedGameId = game.id;
    playSound(game.state.winnerId === currentPlayerId ? 'win' : 'lose');
  }
  $: selectedColorFace = roll && colorDieIndex !== null ? roll.colorDice[colorDieIndex] : null;
  $: selectedNumberFace = roll && numberDieIndex !== null ? roll.numberDice[numberDieIndex] : null;
  $: selectedColor = (diceLocked ? me?.selectedColor : null) ?? (selectedColorFace === 'joker' ? jokerColor : selectedColorFace);
  $: selectedNumber = (diceLocked ? me?.selectedNumber : null) ?? (selectedNumberFace === 'joker' ? jokerNumber : selectedNumberFace);
  // Wechselt Farbe oder Zahl, passt die alte Auswahl nicht mehr: verwerfen.
  $: {
    const key = `${selectedColor ?? ''}:${selectedNumber ?? ''}`;
    if (key !== draftKey) {
      draftKey = key;
      draft = [];
    }
  }
  $: checkedSet = new Set(me ? [...me.checkedCells, ...draft] : []);
  $: pendingSet = new Set(draft);
  $: localCompletedColumnScore = me ? bottomScore.reduce((sum, value, column) => sum + (rows.every((_, row) => me.checkedCells.includes(`${row}-${column}`)) ? value : 0), 0) : 0;
  $: completedColumnScore = me?.score.columnPoints ?? localCompletedColumnScore;
  $: starPenalty = me ? cells.filter((cell) => cell.hasStar && !me.checkedCells.includes(cell.id)).length * -2 : 0;
  $: colorBonus = me?.score.colorPoints ?? 0;
  $: currentJokerCost = (selectedColorFace === 'joker' ? 1 : 0) + (selectedNumberFace === 'joker' ? 1 : 0);
  $: remainingJokers = Math.max(0, jokerCount - (me?.usedJokers ?? 0) - currentJokerCost);
  $: jokerPenalty = me?.score.jokerPenalty ?? (jokerCount - (me?.usedJokers ?? 0));
  $: totalScore = me?.score.total ?? completedColumnScore + colorBonus + starPenalty + jokerPenalty;
  $: confirmedCount = game?.state.confirmedPlayerIds.length ?? 0;
  $: activePlayer = game?.players.find((player) => player.id === game.state.activePlayerId) ?? null;
  $: isAdvantageRound = Boolean(game && game.state.round >= 4);
  $: activeSelectionDone = Boolean(game && game.state.activeColorDieIndex !== null && game.state.activeNumberDieIndex !== null);
  $: activePlayerSkipped = Boolean(activePlayer?.skipped && activePlayer.confirmed && !activeSelectionDone);
  $: isActivePlayer = Boolean(me && game?.state.activePlayerId === me.id);
  $: isPassiveWaiting = Boolean(isAdvantageRound && !isActivePlayer && !activeSelectionDone && !activePlayerSkipped);
  $: canChooseDiceThisRound = Boolean(me && !me.confirmed && (!isAdvantageRound || isActivePlayer || activeSelectionDone || activePlayerSkipped));
  $: hasLocalDiceSelection = Boolean(me && roll && canChooseDiceThisRound && colorDieIndex !== null && numberDieIndex !== null && selectedColor && selectedNumber !== null && isColorDieAvailable(colorDieIndex) && isNumberDieAvailable(numberDieIndex));
  $: hasActiveDiceSelection = Boolean(me && !me.confirmed && (diceLocked || hasLocalDiceSelection));
  // Nur der Startspieler in Vorteilsrunden muss seine Würfel vorab festlegen, damit die anderen weiterspielen können.
  $: mustLockDice = Boolean(isAdvantageRound && isActivePlayer && !activeSelectionDone);
  $: canSelectDice = Boolean(mustLockDice && hasLocalDiceSelection && !diceLocked);
  $: canConfirm = Boolean(me && !me.confirmed && hasActiveDiceSelection && !mustLockDice && selectedColor && selectedNumber && draft.length === Number(selectedNumber) && isConnectedGroup(draft) && hasValidAnchor(me, draft));
  $: isMyMove = Boolean(me && !me.confirmed && game?.status !== 'finished' && game?.state.phase !== 'finished' && !isPassiveWaiting);
  $: actionText = getActionText(game, me, isPassiveWaiting, activePlayerSkipped, mustLockDice, hasActiveDiceSelection, selectedColor, selectedNumber, draft);
  $: if (game) detectNewAchievements(game);

  function claimKey(kind: 'column' | 'color', value: string | number, tier: 'first' | 'normal', playerId: string) {
    return `${kind}:${value}:${tier}:${playerId}`;
  }

  function collectAchievements(session: NochMalSession) {
    const achievements: Achievement[] = [];

    session.state.columnBonusClaims.forEach((claims, column) => {
      for (const tier of ['first', 'normal'] as const) {
        for (const playerId of claims[tier]) {
          achievements.push({
            key: claimKey('column', column, tier, playerId),
            kind: 'column',
            playerId,
            playerName: session.players.find((player) => player.id === playerId)?.name ?? 'Ein Spieler',
            title: `Spalte ${letters[column]} abgeschlossen`,
            detail: tier === 'first' ? 'Erster Spaltenbonus' : 'Spaltenbonus',
            points: tier === 'first' ? topScore[column] : bottomScore[column]
          });
        }
      }
    });

    for (const color of colors) {
      const claims = session.state.colorBonusClaims[color];
      for (const tier of ['first', 'normal'] as const) {
        for (const playerId of claims[tier]) {
          achievements.push({
            key: claimKey('color', color, tier, playerId),
            kind: 'color',
            color,
            playerId,
            playerName: session.players.find((player) => player.id === playerId)?.name ?? 'Ein Spieler',
            title: `${colorNames[color]} vollständig ausgefüllt`,
            detail: tier === 'first' ? 'Erster Farbbonus' : 'Farbbonus',
            points: tier === 'first' ? 5 : 3
          });
        }
      }
    }

    return achievements;
  }

  function formatList(values: string[]) {
    if (values.length < 2) return values[0] ?? '';
    return `${values.slice(0, -1).join(', ')} und ${values.at(-1)}`;
  }

  function combineSimultaneousColumns(achievements: Achievement[]) {
    const combined: Achievement[] = [];
    const columnGroups = new Map<string, Achievement[]>();

    for (const achievement of achievements) {
      if (achievement.kind !== 'column') {
        combined.push(achievement);
        continue;
      }
      const group = columnGroups.get(achievement.playerId) ?? [];
      group.push(achievement);
      columnGroups.set(achievement.playerId, group);
    }

    for (const group of columnGroups.values()) {
      if (group.length === 1) {
        combined.push(group[0]);
        continue;
      }

      const columnLabels = group.map((achievement) => achievement.title.replace(' abgeschlossen', ''));
      combined.push({
        key: group.map((achievement) => achievement.key).join('|'),
        kind: 'column',
        playerId: group[0].playerId,
        playerName: group[0].playerName,
        title: `${formatList(columnLabels)} gleichzeitig abgeschlossen`,
        detail: `${group.length} Spaltenboni`,
        points: group.reduce((sum, achievement) => sum + achievement.points, 0)
      });
    }

    return combined;
  }

  function detectNewAchievements(session: NochMalSession) {
    const achievements = collectAchievements(session);

    if (claimsInitializedForGameId !== session.id) {
      claimsInitializedForGameId = session.id;
      knownClaimKeys = new Set(achievements.map((achievement) => achievement.key));
      achievementQueue = [];
      closeAchievement(false);
      return;
    }

    const newAchievements = achievements.filter((achievement) => !knownClaimKeys.has(achievement.key));
    if (newAchievements.length === 0) return;

    knownClaimKeys = new Set(achievements.map((achievement) => achievement.key));
    achievementQueue = [...achievementQueue, ...combineSimultaneousColumns(newAchievements)];
    showNextAchievement();
  }

  function showNextAchievement() {
    if (activeAchievement || achievementQueue.length === 0) return;
    const [next, ...remaining] = achievementQueue;
    activeAchievement = next;
    achievementQueue = remaining;
    playSound('notify');
    achievementTimer = setTimeout(() => closeAchievement(), 6000);
    if (typeof document !== 'undefined' && !focusBeforeAchievement && document.activeElement instanceof HTMLElement) {
      focusBeforeAchievement = document.activeElement;
    }
    void tick().then(() => achievementCloseButton?.focus());
  }

  function closeAchievement(showNext = true) {
    const wasOpen = Boolean(activeAchievement);
    if (achievementTimer) clearTimeout(achievementTimer);
    achievementTimer = null;
    activeAchievement = null;
    if (showNext && achievementQueue.length > 0) {
      setTimeout(showNextAchievement, 120);
      return;
    }
    if (wasOpen && focusBeforeAchievement?.isConnected) focusBeforeAchievement.focus();
    focusBeforeAchievement = null;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!activeAchievement) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAchievement();
    } else if (event.key === 'Tab') {
      // The dialog has a single focusable control; keep focus inside while it is modal.
      event.preventDefault();
      achievementCloseButton?.focus();
    }
  }

  function scoreRowSummary(tier: 'top' | 'bottom') {
    const values = tier === 'top' ? topScore : bottomScore;
    const parts = values.map((value, index) => {
      const claimedByMe = tier === 'top' ? isTopColumnClaimedByMe(index) : isBottomColumnClaimedByMe(index);
      const claimedByOther = tier === 'top' && isTopColumnClaimedByOther(index);
      return `${letters[index]} ${value}${claimedByMe ? ' (erhalten)' : claimedByOther ? ' (vergeben)' : ''}`;
    });
    return `${tier === 'top' ? 'Erste Spaltenboni' : 'Spaltenwerte'}: ${parts.join(', ')}`;
  }

  function opponentBoardSummary(player: NochMalPlayer) {
    return `Spielblatt von ${player.name}: ${player.checkedCells.length} von ${cells.length} Feldern angekreuzt, ${player.score.total} Punkte`;
  }

  onDestroy(() => {
    if (achievementTimer) clearTimeout(achievementTimer);
  });

  function updateBoardScrollFade(node: HTMLElement) {
    showBoardScrollLeftFade = node.scrollLeft > 4;
    showBoardScrollRightFade = node.scrollLeft < node.scrollWidth - node.clientWidth - 4;
  }

  function persistBoardScroll(node: HTMLElement) {
    node.scrollLeft = boardScrollLeft;
    updateBoardScrollFade(node);

    const onScroll = () => {
      boardScrollLeft = node.scrollLeft;
      updateBoardScrollFade(node);
    };
    const resizeObserver = new ResizeObserver(() => updateBoardScrollFade(node));

    node.addEventListener('scroll', onScroll, { passive: true });
    resizeObserver.observe(node);

    return {
      destroy() {
        node.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
      }
    };
  }

  function getActionText(
    game: NochMalSession | null,
    me: NochMalPlayer | null,
    isPassiveWaiting: boolean,
    activePlayerSkipped: boolean,
    mustLockDice: boolean,
    hasDice: boolean,
    color: NochMalColor | null | undefined,
    number: number | null | undefined,
    draft: string[]
  ) {
    if (!game) return 'Noch mal wird über eine Party gestartet.';
    if (!me) return 'Du schaust diese Runde zu.';
    if (game.status === 'finished' || game.state.phase === 'finished') return 'Die Partie ist beendet.';
    if (me.confirmed) return 'Zug bestätigt. Warte auf die anderen Spieler.';
    if (isPassiveWaiting) return `Warte auf die Auswahl von ${activePlayer?.name ?? 'dem Startspieler'}.`;
    if (activePlayerSkipped && !hasDice) return `${game.players.find((p) => p.id === game.state.activePlayerId)?.name ?? 'Der Startspieler'} passt. Wähle aus allen Würfeln.`;
    if (!hasDice || !color || !number) return mustLockDice ? 'Du bist Startspieler: Wähle einen Farb- und einen Zahlenwürfel.' : 'Wähle einen Farbwürfel und einen Zahlenwürfel.';
    if (mustLockDice) return 'Lege deine Würfel fest, damit die anderen weiterspielen können.';
    const first = me.checkedCells.length === 0;
    if (draft.length === 0) return first ? `Kreuze ${number} ${colorNames[color]}-${number === 1 ? 'Feld' : 'Felder'} an – das erste in Spalte H.` : `Kreuze ${number} zusammenhängende ${colorNames[color]}-${number === 1 ? 'Feld' : 'Felder'} an.`;
    if (draft.length < number) return `Noch ${number - draft.length} ${number - draft.length === 1 ? 'Feld' : 'Felder'} – die hellen Felder sind möglich.`;
    return 'Passt! Bestätige deinen Zug.';
  }

  function getAudio(name: SoundName) {
    if (typeof Audio === 'undefined') return null;

    const cached = audioCache.get(name);
    if (cached) return cached;

    const audio = new Audio(soundSources[name]);
    audio.preload = 'metadata';
    audioCache.set(name, audio);
    return audio;
  }

  function effectVolume() {
    if (typeof localStorage === 'undefined') return 0.85;
    const value = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.85;
  }

  function playSound(name: SoundName) {
    const audio = getAudio(name);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = effectVolume();
    void audio.play().catch(() => {
      // Browsers may block playback until the first user gesture.
    });
  }

  function selectDice() {
    if (!canSelectDice || colorDieIndex === null || numberDieIndex === null || !selectedColor || selectedNumber === null) return;
    playSound('confirm');
    onMove({ type: 'select-dice', colorDieIndex, numberDieIndex, color: selectedColor, number: Number(selectedNumber) });
  }

  function isColorDieAvailable(index: number | null) {
    if (index === null || !game) return false;
    if (!isAdvantageRound || isActivePlayer || activePlayerSkipped) return true;
    return activeSelectionDone && index !== game.state.activeColorDieIndex;
  }

  function isNumberDieAvailable(index: number | null) {
    if (index === null || !game) return false;
    if (!isAdvantageRound || isActivePlayer || activePlayerSkipped) return true;
    return activeSelectionDone && index !== game.state.activeNumberDieIndex;
  }

  function shouldAutoSelectDice(nextColorDieIndex: number | null, nextNumberDieIndex: number | null) {
    if (!roll || nextColorDieIndex === null || nextNumberDieIndex === null) return false;
    return roll.colorDice[nextColorDieIndex] !== 'joker' && roll.numberDice[nextNumberDieIndex] !== 'joker';
  }

  function chooseColorDie(index: number) {
    if (!isColorDieAvailable(index) || !canChooseDiceThisRound) return;
    playSound('select');
    colorDieIndex = index;
    if (shouldAutoSelectDice(index, numberDieIndex)) setTimeout(selectDice, 0);
    if (numberDieIndex !== null) void tick().then(revealBoard);
  }

  function chooseNumberDie(index: number) {
    if (!isNumberDieAvailable(index) || !canChooseDiceThisRound) return;
    playSound('select');
    numberDieIndex = index;
    if (shouldAutoSelectDice(colorDieIndex, index)) setTimeout(selectDice, 0);
    if (colorDieIndex !== null) void tick().then(revealBoard);
  }

  function clearSelection() {
    playSound('select');
    draft = [];
  }
  function confirmTurn() {
    if (!canConfirm || colorDieIndex === null || numberDieIndex === null || !selectedColor || selectedNumber === null) return;
    playSound('confirm');
    onMove({ type: 'submit-turn', colorDieIndex, numberDieIndex, color: selectedColor, number: Number(selectedNumber), cellIds: draft });
  }

  function skipTurn() {
    playSound('notify');
    draft = [];
    onMove({ type: 'skip-turn' });
  }

  function toggleCell(cellId: string) {
    if (!me || me.confirmed || !hasActiveDiceSelection || mustLockDice) return;
    if (draft.includes(cellId)) {
      // Entfernen nur, wenn der Rest zusammenhängend bleibt; sonst alles ab diesem Feld verwerfen.
      const rest = draft.filter((id) => id !== cellId);
      draft = rest.length === 0 || isConnectedGroup(rest) ? rest : [];
      playSound('select');
      return;
    }
    if (!isCellSelectable({ id: cellId, color: cells.find((cell) => cell.id === cellId)?.color ?? 'lime' }, draft, selectedColor, selectedNumber)) return;
    draft = [...draft, cellId];
    playSound('mark');
  }
  function isCellSelectable(
    cell: { id: string; color: NochMalColor },
    currentDraft: string[] = draft,
    color: NochMalColor | null | undefined = selectedColor,
    number: number | null | undefined = selectedNumber
  ) {
    if (!me || me.confirmed || !hasActiveDiceSelection || mustLockDice) return false;
    if (me.checkedCells.includes(cell.id)) return false;
    if (color && cell.color !== color) return false;
    if (currentDraft.includes(cell.id)) return true;
    if (number === null || number === undefined || currentDraft.length >= Number(number)) return false;
    const candidate = [...currentDraft, cell.id];
    return isConnectedGroup(candidate) && hasValidAnchor(me, candidate);
  }

  function isConnectedGroup(ids: string[]) {
    if (ids.length <= 1) return true;
    const selected = new Set(ids);
    const seen = new Set([ids[0]]);
    const queue = [ids[0]];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      for (const candidate of selected) {
        if (!seen.has(candidate) && areAdjacent(current, candidate)) {
          seen.add(candidate);
          queue.push(candidate);
        }
      }
    }
    return seen.size === selected.size;
  }

  function areAdjacent(first: string, second: string) {
    const [firstRow, firstColumn] = first.split('-').map(Number);
    const [secondRow, secondColumn] = second.split('-').map(Number);
    return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
  }

  function hasValidAnchor(player: NochMalPlayer, pending: string[]) {
    if (pending.length === 0) return false;
    if (pending.some((id) => Number(id.split('-')[1]) === 7)) return true;
    return pending.some((id) => player.checkedCells.some((checkedId) => areAdjacent(id, checkedId)));
  }

  function colorDieLabel(value: NochMalColorDie) {
    return value === 'joker' ? 'Joker' : colorNames[value];
  }

  function numberDieLabel(value: NochMalNumberDie) {
    return value === 'joker' ? '?' : String(value);
  }

  function columnClaims(column: number) {
    return game?.state.columnBonusClaims?.[column] ?? { first: [], normal: [] };
  }

  function isTopColumnClaimedByPlayer(column: number, playerId: string) {
    return columnClaims(column).first.includes(playerId);
  }

  function isTopColumnClaimedByOtherPlayer(column: number, playerId: string) {
    const claims = columnClaims(column);
    return claims.first.length > 0 && !claims.first.includes(playerId);
  }

  function isBottomColumnClaimedByPlayer(column: number, playerId: string) {
    return columnClaims(column).normal.includes(playerId);
  }

  function isTopColumnClaimedByMe(column: number) {
    return Boolean(me && isTopColumnClaimedByPlayer(column, me.id));
  }

  function isTopColumnClaimedByOther(column: number) {
    return Boolean(me && isTopColumnClaimedByOtherPlayer(column, me.id));
  }

  function isBottomColumnClaimedByMe(column: number) {
    return Boolean(me && isBottomColumnClaimedByPlayer(column, me.id));
  }

  function columnScoreLabel(column: number, tier: 'top' | 'bottom') {
    const claims = columnClaims(column);
    if (!me || (claims.first.length === 0 && claims.normal.length === 0)) return 'Noch nicht vergeben';
    if (tier === 'top') {
      if (claims.first.includes(me.id)) return 'Du hast diesen ersten Spaltenbonus erhalten';
      return 'Der erste Spaltenbonus wurde bereits vergeben';
    }
    if (claims.normal.includes(me.id)) return 'Du hast den unteren Spaltenwert erhalten';
    return claims.first.length > 0 && !claims.first.includes(me.id) ? 'Unterer Spaltenwert für dich noch möglich' : 'Unterer Spaltenwert wird nach dem ersten Abschluss relevant';
  }
</script>


{#if !game}
  <p class="ui-panel text-[0.9375rem] leading-6" style="color: var(--text);">
    Noch mal läuft über die Party-Lobby, damit Würfelrunde, Spielerstatus, Reconnect und Ergebnis synchron bleiben.
  </p>
{:else}
  <section class="nm w-full">
    <!-- 1. Statuszeile: ein Satz, was jetzt zu tun ist -->
    <header class="nm-status">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        {#if me?.confirmed}
          <span class="ui-chip ui-chip--positive"><Check size={14} strokeWidth={2.5} aria-hidden="true" /> Bestätigt</span>
        {:else if isMyMove}
          <span class="ui-chip ui-chip--accent">Du bist dran</span>
        {/if}
        <p class="nm-status-text" aria-live="polite">{actionText}</p>
      </div>
      <p class="nm-meta ui-num">
        Runde {game.state.round} · {confirmedCount} von {game.players.length} bestätigt{#if isAdvantageRound} · Startspieler: {activePlayer?.name ?? 'offen'}{/if}
      </p>
    </header>

    <div class="nm-layout">
      <!-- 2. Würfelablage: was kann ich jetzt tun? -->
      <aside class="nm-tray-col">
        <section class="ui-panel nm-tray" aria-label="Würfel und Aktionen">
          <div class="nm-dice-row">
            <span class="nm-dice-label" id="nm-color-dice-label">Farbe</span>
            <div class="nm-dice" role="group" aria-labelledby="nm-color-dice-label">
              {#each game.state.roll.colorDice as die, index (`color-${game.state.roll.id}-${index}`)}
                {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && !activePlayerSkipped && index === game.state.activeColorDieIndex}
                {@const picked = colorDieIndex === index || me?.selectedColorDieIndex === index}
                {@const off = isLoading || me?.confirmed || !canChooseDiceThisRound || !isColorDieAvailable(index) || diceLocked}
                <button
                  type="button"
                  disabled={off}
                  on:click={() => chooseColorDie(index)}
                  class="nm-die {die === 'joker' ? 'nm-die--joker' : colorClass[die]}"
                  class:hidden={removedByActive}
                  class:nm-die--picked={picked}
                  class:nm-die--off={off && !picked}
                  aria-label={`Farbwürfel ${index + 1}: ${colorDieLabel(die)}`}
                  aria-pressed={picked}
                >
                  {#if die === 'joker'}
                    ?
                  {:else}
                    <span class="relative block h-5 w-5 bg-current {colorSymbolClass[die]}" aria-hidden="true"></span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <div class="nm-dice-row">
            <span class="nm-dice-label" id="nm-number-dice-label">Zahl</span>
            <div class="nm-dice" role="group" aria-labelledby="nm-number-dice-label">
              {#each game.state.roll.numberDice as die, index (`number-${game.state.roll.id}-${index}`)}
                {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && !activePlayerSkipped && index === game.state.activeNumberDieIndex}
                {@const picked = numberDieIndex === index || me?.selectedNumberDieIndex === index}
                {@const off = isLoading || me?.confirmed || !canChooseDiceThisRound || !isNumberDieAvailable(index) || diceLocked}
                <button
                  type="button"
                  disabled={off}
                  on:click={() => chooseNumberDie(index)}
                  class="nm-die nm-die--number"
                  class:hidden={removedByActive}
                  class:nm-die--picked={picked}
                  class:nm-die--off={off && !picked}
                  aria-label={`Zahlenwürfel ${index + 1}: ${die === 'joker' ? 'Joker' : numberDieLabel(die)}`}
                  aria-pressed={picked}
                >{numberDieLabel(die)}</button>
              {/each}
            </div>
          </div>

          {#if selectedColorFace === 'joker' || selectedNumberFace === 'joker'}
            <div class="nm-joker">
              {#if selectedColorFace === 'joker'}
                <div role="radiogroup" aria-label="Jokerfarbe" class="nm-joker-row">
                  <span class="ui-label nm-joker-label">Jokerfarbe</span>
                  <div class="nm-joker-options">
                    {#each colors as color (color)}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={jokerColor === color}
                        aria-label={colorNames[color]}
                        disabled={diceLocked}
                        on:click={() => { jokerColor = color; playSound('select'); }}
                        class="nm-joker-swatch {colorClass[color]}"
                        class:is-on={jokerColor === color}
                      ></button>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if selectedNumberFace === 'joker'}
                <div role="radiogroup" aria-label="Jokerzahl" class="nm-joker-row">
                  <span class="ui-label nm-joker-label">Jokerzahl</span>
                  <div class="nm-joker-options">
                    {#each [1, 2, 3, 4, 5] as value (value)}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={jokerNumber === value}
                        disabled={diceLocked}
                        on:click={() => { jokerNumber = value; playSound('select'); }}
                        class="nm-joker-num ui-num"
                        class:is-on={jokerNumber === value}
                      >{value}</button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            {#if currentJokerCost > 0}
              <p class="ui-muted text-sm">Kostet <span class="ui-num">{currentJokerCost}</span> Joker, danach <span class="ui-num">{remainingJokers}</span> übrig.</p>
            {/if}
          {/if}
          {#if mustLockDice && !diceLocked && hasLocalDiceSelection}
            <button type="button" disabled={!canSelectDice || isLoading} on:click={selectDice} class="ui-btn ui-btn--primary ui-btn--block">
              {#if isLoading}<LoaderCircle class="animate-spin" size={17} aria-hidden="true" />{/if} Würfel festlegen
            </button>
          {/if}

          <div class="nm-actions">
            <button type="button" disabled={!canConfirm || isLoading} on:click={confirmTurn} class="ui-btn ui-btn--primary ui-btn--lg ui-btn--block hidden lg:inline-flex">
              {#if isLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{:else}<Check size={18} aria-hidden="true" />{/if} Zug bestätigen
            </button>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" disabled={!me || me.confirmed || draft.length === 0} on:click={clearSelection} class="ui-btn">
                <RotateCcw size={16} aria-hidden="true" /> Leeren
              </button>
              <button type="button" disabled={!me || me.confirmed || isLoading} on:click={skipTurn} class="ui-btn">
                Kein Zug möglich
              </button>
            </div>
          </div>
        </section>
      </aside>

      <div class="nm-main">
        <!-- 3. Eigenes Spielblatt, groß -->
        {#if me}
          <section class="nm-own" aria-labelledby="nm-own-title" bind:this={ownSection}>
            <div class="nm-own-head">
              <div class="flex min-w-0 items-center gap-3">
                <h2 id="nm-own-title" class="ui-section-title nm-own-title">Dein Blatt</h2>
                {#if hasActiveDiceSelection && selectedColor && selectedNumber}
                  <span class="ui-chip ui-num">{colorNames[selectedColor]} × {selectedNumber} · {draft.length}/{selectedNumber}</span>
                {/if}
              </div>
              <dl class="nm-stats ui-num">
                <div class="nm-stat nm-stat--total"><dt>Punkte</dt><dd>{totalScore}</dd></div>
                <div class="nm-stat"><dt>Spalten</dt><dd>{completedColumnScore}</dd></div>
                <div class="nm-stat"><dt>Farben</dt><dd>{colorBonus}</dd></div>
                <div class="nm-stat"><dt>Sterne</dt><dd>{starPenalty}</dd></div>
                <div class="nm-stat"><dt>Joker übrig</dt><dd>{remainingJokers}</dd></div>
              </dl>
            </div>

            <div class="relative">
              <div class="touch-scroll-x w-full overscroll-x-contain overflow-x-auto pb-2" use:persistBoardScroll>
                <div class="mx-auto w-full min-w-[38rem] p-1 md:min-w-0">
                  <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                    {#each letters as letter, index (letter)}
                      <div class="noch-mal-paper grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black text-slate-950 sm:text-base {index === 7 ? 'text-red-500 ring-2 ring-[#e68b2f]' : ''}">{letter}</div>
                    {/each}
                  </div>

                  <div class="nm-grid mt-2">
                    {#each cells as cell (cell.id)}
                      {@const checked = checkedSet.has(cell.id)}
                      {@const pending = pendingSet.has(cell.id)}
                      {@const selectable = isCellSelectable(cell, draft, selectedColor, selectedNumber)}
                      <button
                        type="button"
                        aria-label={`Feld ${letters[cell.column]}, Reihe ${cell.row + 1}, ${colorNames[cell.color]}${pending ? ', vorgemerkt' : ''}`}
                        aria-pressed={checked}
                        disabled={me.confirmed || (!selectable && !pending)}
                        on:click={() => toggleCell(cell.id)}
                        class="nm-cell {colorClass[cell.color]}"
                        class:nm-cell--selectable={selectable && !pending}
                        class:nm-cell--pending={pending}
                        class:nm-cell--dim={!selectable && !checked && hasActiveDiceSelection && !mustLockDice}
                      >
                        {#if cell.hasStar}
                          <Star class="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow sm:h-8 sm:w-8 {checked ? 'opacity-25' : ''}" strokeWidth={2.4} />
                        {/if}
                        {#if checked}
                          <span class="nm-cross {pending ? 'nm-cross--pending' : ''}" aria-hidden="true"></span>
                        {/if}
                      </button>
                    {/each}
                  </div>

                  <div class="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1" role="img" aria-label={scoreRowSummary('top')}>
                    {#each topScore as value, index (`top-${index}`)}
                      {@const claimedByMe = isTopColumnClaimedByMe(index)}
                      {@const claimedByOther = isTopColumnClaimedByOther(index)}
                      <div
                        class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black sm:text-base {index === 7 ? 'text-red-500' : 'text-slate-950'} {claimedByOther ? 'opacity-60' : ''}"
                        title={columnScoreLabel(index, 'top')}
                        aria-hidden="true"
                      >
                        {value}
                        {#if claimedByMe}
                          <span class="pointer-events-none absolute inset-1 rounded-full border-2 border-emerald-600"></span>
                        {:else if claimedByOther}
                          <span class="pointer-events-none absolute left-1/2 top-1/2 h-1 w-[74%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full bg-rose-500/85"></span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                  <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1" role="img" aria-label={scoreRowSummary('bottom')}>
                    {#each bottomScore as value, index (`bottom-${index}`)}
                      {@const claimedByMe = isBottomColumnClaimedByMe(index)}
                      <div
                        class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black sm:text-base {index === 7 ? 'text-red-500' : 'text-slate-950'}"
                        title={columnScoreLabel(index, 'bottom')}
                        aria-hidden="true"
                      >
                        {value}
                        {#if claimedByMe}
                          <span class="pointer-events-none absolute inset-1 rounded-full border-2 border-emerald-600"></span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
              {#if showBoardScrollLeftFade}
                <div class="nm-fade nm-fade--left" aria-hidden="true"></div>
              {/if}
              {#if showBoardScrollRightFade}
                <div class="nm-fade nm-fade--right" aria-hidden="true"></div>
              {/if}
            </div>
          </section>
        {/if}

        <!-- 4. Mitspieler kompakt -->
        {#if opponents.length > 0}
          <section class="nm-opponents" aria-labelledby="nm-opponents-title">
            <h2 id="nm-opponents-title" class="ui-section-title">Mitspieler</h2>
            <ul class="nm-opponent-list touch-scroll-x">
              {#each opponents as player (player.id)}
                <li class="ui-card nm-opponent">
                  <div class="flex items-center gap-3">
                    <span class="ui-avatar" style="--player: {playerHexById(players, player.id)}" aria-hidden="true">{initials(player.name)}</span>
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate text-[0.9375rem] font-semibold" style="color: var(--text);">{player.name}</h3>
                      <p class="ui-muted ui-num text-sm">{player.score.total} Punkte</p>
                    </div>
                    {#if player.confirmed}
                      <span class="ui-chip ui-chip--positive">fertig</span>
                    {:else}
                      <span class="ui-muted text-sm">spielt</span>
                    {/if}
                  </div>

                  <div class="nm-mini mt-3">
                    <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px" role="img" aria-label={opponentBoardSummary(player)}>
                      {#each cells as cell (cell.id)}
                        {@const checked = player.checkedCells.includes(cell.id)}
                        <span
                          class="relative aspect-square min-w-0 rounded-[2px] {colorClass[cell.color]}"
                          title={`${player.name}: ${letters[cell.column]}${cell.row + 1}`}
                          aria-hidden="true"
                        >
                          {#if cell.hasStar}
                            <Star class="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-white/90 {checked ? 'opacity-25' : ''}" strokeWidth={2.4} />
                          {/if}
                          {#if checked}
                            <span class="nm-cross nm-cross--mini" aria-hidden="true"></span>
                          {/if}
                        </span>
                      {/each}
                    </div>

                    <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px" aria-hidden="true">
                      {#each topScore as value, index (`mini-top-${player.id}-${index}`)}
                        {@const claimedByPlayer = isTopColumnClaimedByPlayer(index, player.id)}
                        {@const claimedByOther = isTopColumnClaimedByOtherPlayer(index, player.id)}
                        <span class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-[2px] bg-[#f7f5ea] text-[0.55rem] font-black text-slate-900 {claimedByOther ? 'opacity-55' : ''}">
                          {value}
                          {#if claimedByPlayer}
                            <span class="pointer-events-none absolute inset-0.5 rounded-full border border-emerald-600"></span>
                          {:else if claimedByOther}
                            <span class="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full bg-rose-500/85"></span>
                          {/if}
                        </span>
                      {/each}
                    </div>
                    <div class="mt-px grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px" aria-hidden="true">
                      {#each bottomScore as value, index (`mini-bottom-${player.id}-${index}`)}
                        {@const claimedByPlayer = isBottomColumnClaimedByPlayer(index, player.id)}
                        <span class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-[2px] bg-[#f7f5ea] text-[0.55rem] font-black text-slate-900">
                          {value}
                          {#if claimedByPlayer}
                            <span class="pointer-events-none absolute inset-0.5 rounded-full border border-emerald-600"></span>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    </div>
    {#if me && !me.confirmed && game.status !== 'finished'}
      <!-- Mobil/Tablet: Bestätigen bleibt unter dem Blatt erreichbar. Sticky (nicht fixed), damit die Leiste ihren Platz reserviert und nichts dauerhaft verdeckt. -->
      <div class="nm-bar">
        <div class="min-w-0 flex-1 text-sm leading-tight">
          {#if hasActiveDiceSelection && selectedColor && selectedNumber}
            <span class="block font-semibold" style="color: var(--text);">{colorNames[selectedColor]} × {selectedNumber}</span>
            <span class="ui-muted ui-num whitespace-nowrap">{draft.length}/{selectedNumber} markiert</span>
          {:else}
            <span class="block font-semibold" style="color: var(--text);">Würfel wählen</span>
            <span class="ui-muted">Farbe und Zahl oben</span>
          {/if}
        </div>
        <button type="button" disabled={draft.length === 0} on:click={clearSelection} class="ui-btn ui-btn--icon nm-bar-clear" aria-label="Auswahl leeren">
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button type="button" disabled={!canConfirm || isLoading} on:click={confirmTurn} class="ui-btn ui-btn--primary shrink-0">
          {#if isLoading}<LoaderCircle class="animate-spin" size={17} aria-hidden="true" />{:else}<Check size={17} aria-hidden="true" />{/if} Zug bestätigen
        </button>
      </div>
    {/if}
  </section>
{/if}

<svelte:window on:keydown={handleWindowKeydown} />

{#if activeAchievement}
  <div class="ui-dialog-backdrop nm-achievement-layer">
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      on:click={() => closeAchievement()}
      aria-label="Erfolgsmeldung schließen"
      tabindex="-1"
    ></button>
    <div
      class="ui-dialog relative animate-modal-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="noch-mal-achievement-title"
      aria-describedby="noch-mal-achievement-detail"
    >
      <button
        type="button"
        bind:this={achievementCloseButton}
        on:click={() => closeAchievement()}
        class="ui-btn ui-btn--ghost ui-btn--icon absolute right-3 top-3"
        aria-label="Schließen"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <h2 id="noch-mal-achievement-title" class="pr-10 text-xl font-semibold leading-snug" style="color: var(--text);">
        {activeAchievement.playerId === currentPlayerId ? 'Du hast' : `${activeAchievement.playerName} hat`}
        {#if activeAchievement.kind === 'color' && activeAchievement.color}
          <span class="nm-swatch {colorClass[activeAchievement.color]}" aria-hidden="true"></span><span class="font-semibold">{colorNames[activeAchievement.color]}</span> vollständig ausgefüllt.
        {:else}
          {activeAchievement.title}.
        {/if}
      </h2>
      <p id="noch-mal-achievement-detail" class="ui-muted mt-2 text-[0.9375rem]">{activeAchievement.detail}: <span class="ui-num font-semibold" style="color: var(--text);">+{activeAchievement.points}</span> Punkte</p>

      {#if achievementQueue.length > 0}<p class="ui-muted mt-4 text-sm">{achievementQueue.length} weitere Meldung{achievementQueue.length === 1 ? '' : 'en'}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .nm { display: flex; flex-direction: column; gap: var(--gap); }

  /* 1. Statuszeile */
  .nm-status { display: flex; flex-direction: column; gap: 6px; }
  .nm-status-text { margin: 0; min-height: 1.5rem; font-size: 1.0625rem; line-height: 1.4; font-weight: 600; color: var(--text); text-wrap: pretty; }
  .nm-meta { margin: 0; font-size: 0.875rem; color: var(--muted); }

  .nm-layout { display: grid; gap: 24px; }
  .nm-main { display: flex; min-width: 0; flex-direction: column; gap: 28px; }
  @media (min-width: 1024px) {
    .nm-layout { grid-template-columns: minmax(0, 1fr) 21rem; align-items: start; }
    .nm-tray-col { order: 2; position: sticky; top: 16px; }
    .nm-main { order: 1; }
  }

  /* 2. Würfelablage */
  .nm-tray { display: flex; flex-direction: column; gap: 14px; }
  .nm-dice-row { display: flex; align-items: center; gap: 12px; }
  .nm-dice-label { width: 3.25rem; flex-shrink: 0; font-size: 0.875rem; font-weight: 600; color: var(--muted); }
  .nm-dice { display: flex; flex: 1; gap: 10px; }
  .nm-die {
    display: grid; place-items: center;
    width: 64px; height: 64px; flex-shrink: 0;
    border-radius: var(--radius-inner);
    font-size: 1.5rem; font-weight: 700; line-height: 1;
    cursor: pointer; touch-action: manipulation;
    border: 1px solid rgb(0 0 0 / 0.12);
    transition: transform 120ms ease, opacity 150ms ease, outline-color 150ms ease;
    outline: 3px solid transparent; outline-offset: 3px;
  }
  .nm-die--number, .nm-die--joker { background: #ffffff; color: #1f201d; }
  .nm-die:active:not(:disabled) { transform: scale(0.94); }
  .nm-die:focus-visible { outline-color: var(--accent-main); }
  .nm-die--picked { outline-color: var(--accent-main); }
  .nm-die:disabled { cursor: not-allowed; }
  .nm-die--off { opacity: 0.4; }
  .nm-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }

  /* 3. Eigenes Blatt */
  .nm-own { display: flex; flex-direction: column; gap: 12px; }
  .nm-own-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; }
  .nm-own-title { font-size: 1.125rem; }
  .nm-stats { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; }
  .nm-stat { display: flex; align-items: baseline; gap: 6px; }
  .nm-stat dt { font-size: 0.8125rem; color: var(--muted); }
  .nm-stat dd { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text); }
  .nm-stat--total dd { font-size: 1.0625rem; }

  .nm-grid { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); overflow: hidden; border-radius: 12px; border: 1px solid rgb(0 0 0 / 0.14); background: #f7f5ea; }
  .nm-cell {
    position: relative; aspect-ratio: 1; min-width: 0;
    border: 0; border-right: 1px solid rgb(15 23 42 / 0.2); border-bottom: 1px solid rgb(15 23 42 / 0.2);
    touch-action: manipulation; transition: opacity 150ms ease, filter 150ms ease;
  }
  .nm-cell:disabled { cursor: not-allowed; }
  .nm-cell:focus-visible { z-index: 20; outline: 3px solid #1f201d; outline-offset: -3px; }
  .nm-cell--dim { opacity: 0.3; }
  .nm-joker { display: grid; gap: 12px; }
  .nm-joker-label { margin-bottom: 6px; }
  .nm-joker-options { display: flex; flex-wrap: wrap; gap: 8px; }
  .nm-joker-swatch, .nm-joker-num { width: 44px; height: 44px; border: 0; border-radius: 12px; cursor: pointer; transition: transform 120ms ease; }
  .nm-joker-num { background: var(--raised); color: var(--text); font-size: 1.125rem; font-weight: 700; box-shadow: inset 0 0 0 1px var(--border); }
  .nm-joker-swatch.is-on, .nm-joker-num.is-on { box-shadow: 0 0 0 3px var(--ground), 0 0 0 5px var(--accent-main); }
  .nm-joker-swatch:active, .nm-joker-num:active { transform: scale(0.94); }
  .nm-joker-swatch:focus-visible, .nm-joker-num:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 3px; }
  .nm-joker-swatch:disabled, .nm-joker-num:disabled { cursor: not-allowed; opacity: 0.6; }
  .nm-cell--selectable { z-index: 5; box-shadow: inset 0 0 0 2.5px rgb(255 255 255 / 0.95), 0 0 0 1px rgb(31 32 29 / 0.35); }
  /* Vorgemerkt: dunkles Kreuz in weißem Rahmen – unterscheidet sich klar vom bestätigten weißen Kreuz. */
  .nm-cell--pending { z-index: 10; box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 5px #1f201d; }

  .nm-cross { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
  .nm-cross::before, .nm-cross::after {
    content: ''; position: absolute; left: 12.5%; top: 50%; width: 75%; height: 6px; margin-top: -3px;
    border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.12);
  }
  .nm-cross::before { transform: rotate(45deg); }
  .nm-cross::after { transform: rotate(-45deg); }
  .nm-cross--pending::before, .nm-cross--pending::after { background: #1f201d; box-shadow: none; }
  .nm-cross--mini::before, .nm-cross--mini::after { height: 2px; margin-top: -1px; box-shadow: none; }

  .nm-fade { position: absolute; top: 0; bottom: 8px; width: 32px; pointer-events: none; }
  .nm-fade--left { left: 0; background: linear-gradient(to right, var(--ground), transparent); }
  .nm-fade--right { right: 0; background: linear-gradient(to left, var(--ground), transparent); }

  @media (hover: hover) and (pointer: fine) {
    .nm-die:hover:not(:disabled) { transform: translateY(-1px); }
    .nm-cell--selectable:hover { filter: brightness(1.1); }
  }

  /* 4. Mitspieler */
  .nm-opponents { display: flex; flex-direction: column; gap: 12px; }
  .nm-opponent-list { display: flex; gap: 12px; margin: 0; padding: 0 0 4px; list-style: none; overflow-x: auto; }
  .nm-opponent { flex: 0 0 min(80%, 18rem); scroll-snap-align: start; }
  @media (min-width: 768px) {
    .nm-opponent-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr)); padding: 0; overflow: visible; }
  }
  .nm-mini { border-radius: 8px; }

  /* Mobile Bestätigungsleiste */
  .nm-bar {
    position: sticky; bottom: 0; z-index: 30;
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: var(--surface); border-radius: var(--radius-card) var(--radius-card) 0 0;
  }
  .nm-bar-clear { background: var(--ground); }
  @media (min-width: 1024px) { .nm-bar { display: none; } }

  .nm-achievement-layer { z-index: 95; }
  .nm-swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.3em; border-radius: 4px; vertical-align: -0.05em; }

  @media (prefers-reduced-motion: reduce) {
    .nm-die, .nm-cell { transition: none; }
    .nm-die:active:not(:disabled) { transform: none; }
  }
</style>
