<script lang="ts">
  import { Check, CircleHelp, Info, RotateCcw, Sparkles, Star, X } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import { bottomScore, cells, jokerCount, letters, rows, topScore } from '../data/board';
  import type { NochMalColor, NochMalColorDie, NochMalNumberDie, NochMalPlayer, NochMalSession } from '../types';

  export let game: NochMalSession | null = null;
  export let currentPlayerId = '';
  export let isLoading = false;
  export let onMove: (move: Record<string, unknown>) => void = () => {};
  export let renderNonce = 0;

  let colorDieIndex: number | null = null;
  let numberDieIndex: number | null = null;
  let jokerColor: NochMalColor = 'lime';
  let jokerNumber = 1;
  let lastRollId = '';
  let lastFinishedGameId = '';
  let soundEnabled = true;
  let claimsInitializedForGameId = '';
  let knownClaimKeys = new Set<string>();
  let achievementQueue: Achievement[] = [];
  let activeAchievement: Achievement | null = null;
  let achievementTimer: ReturnType<typeof setTimeout> | null = null;

  type Achievement = {
    key: string;
    kind: 'column' | 'color';
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

  $: nochMalVersion = game ? `${game.id}:${JSON.stringify(game.state)}:${JSON.stringify(game.players)}:${renderNonce}` : '';
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
  }
  $: if (game?.status === 'finished' && game.id !== lastFinishedGameId) {
    lastFinishedGameId = game.id;
    playSound(game.state.winnerId === currentPlayerId ? 'win' : 'lose');
  }
  $: selectedColorFace = roll && colorDieIndex !== null ? roll.colorDice[colorDieIndex] : null;
  $: selectedNumberFace = roll && numberDieIndex !== null ? roll.numberDice[numberDieIndex] : null;
  $: selectedColor = me?.selectedColor ?? (selectedColorFace === 'joker' ? jokerColor : selectedColorFace);
  $: selectedNumber = me?.selectedNumber ?? (selectedNumberFace === 'joker' ? jokerNumber : selectedNumberFace);
  $: checkedSet = new Set(me ? [...me.checkedCells, ...me.pendingCells] : []);
  $: pendingSet = new Set(me?.pendingCells ?? []);
  $: localCompletedColumnScore = me ? bottomScore.reduce((sum, value, column) => sum + (rows.every((_, row) => me.checkedCells.includes(`${row}-${column}`)) ? value : 0), 0) : 0;
  $: completedColumnScore = me?.score.columnPoints ?? localCompletedColumnScore;
  $: starPenalty = me ? cells.filter((cell) => cell.hasStar && !me.checkedCells.includes(cell.id)).length * -2 : 0;
  $: colorBonus = me?.score.colorPoints ?? 0;
  $: currentJokerCost = (selectedColorFace === 'joker' && !me?.selectedColor ? 1 : 0) + (selectedNumberFace === 'joker' && !me?.selectedNumber ? 1 : 0);
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
  $: hasActiveDiceSelection = Boolean(me && !me.confirmed && ((me.selectedColor && me.selectedNumber) || hasLocalDiceSelection));
  $: canSelectDice = Boolean(hasLocalDiceSelection && !me?.selectedColor && !me?.selectedNumber);
  $: canConfirm = Boolean(me && !me.confirmed && me.selectedColor && me.selectedNumber && me.pendingCells.length === me.selectedNumber && isConnectedGroup(me.pendingCells) && hasValidAnchor(me, me.pendingCells));
  $: actionText = getActionText();
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
  }

  function closeAchievement(showNext = true) {
    if (achievementTimer) clearTimeout(achievementTimer);
    achievementTimer = null;
    activeAchievement = null;
    if (showNext) setTimeout(showNextAchievement, 120);
  }

  onDestroy(() => {
    if (achievementTimer) clearTimeout(achievementTimer);
  });

  function getActionText() {
    if (!game) return 'Noch mal wird über eine Party gestartet.';
    if (!me) return 'Du schaust diese Runde zu.';
    if (game.status === 'finished' || game.state.phase === 'finished') return 'Die Partie ist beendet.';
    if (me.confirmed) return 'Zug bestätigt. Warte auf die anderen Spieler.';
    if (isPassiveWaiting) return `Warte auf die Auswahl von ${activePlayer?.name ?? 'dem Startspieler'}.`;
    if (activePlayerSkipped && !isActivePlayer && !me.confirmed && !me.selectedColor) return `${activePlayer?.name ?? 'Der Startspieler'} passt. Wähle aus allen Würfeln.`;
    if (isAdvantageRound && isActivePlayer && !activeSelectionDone && !me.selectedColor) return 'Du bist Startspieler: Wähle zuerst einen Farb- und einen Zahlenwürfel.';
    if (!me.selectedColor || !me.selectedNumber) return 'Wähle einen Farbwürfel und einen Zahlenwürfel.';
    if (me.pendingCells.length === 0) return `Markiere genau ${me.selectedNumber} zusammenhängende ${colorNames[me.selectedColor]}-Felder.`;
    if (!isConnectedGroup(me.pendingCells)) return 'Die Auswahl muss orthogonal zusammenhängen.';
    if (!hasValidAnchor(me, me.pendingCells)) return me.checkedCells.length === 0 ? 'Der erste Zug muss die H-Spalte berühren.' : 'Die Auswahl muss an deine bestehenden Kreuze anschließen oder die H-Spalte berühren.';
    if (me.pendingCells.length !== me.selectedNumber) return `Noch ${me.selectedNumber - me.pendingCells.length} Feld(er) auswählen.`;
    return 'Auswahl gültig. Bestätige deinen Zug.';
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
    if (!soundEnabled) return;

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

  function maybeCommitDiceSelection() {
    if (!me || me.selectedColor || me.selectedNumber) return true;
    if (!canSelectDice || colorDieIndex === null || numberDieIndex === null || !selectedColor || selectedNumber === null) return false;
    onMove({ type: 'select-dice', colorDieIndex, numberDieIndex, color: selectedColor, number: Number(selectedNumber) });
    return true;
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
  }

  function chooseNumberDie(index: number) {
    if (!isNumberDieAvailable(index) || !canChooseDiceThisRound) return;
    playSound('select');
    numberDieIndex = index;
    if (shouldAutoSelectDice(colorDieIndex, index)) setTimeout(selectDice, 0);
  }

  function clearSelection() {
    playSound('select');
    onMove({ type: 'clear-selection' });
  }

  function confirmTurn() {
    if (!canConfirm) return;
    playSound('confirm');
    onMove({ type: 'confirm-turn' });
  }

  function skipTurn() {
    playSound('notify');
    onMove({ type: 'skip-turn' });
  }

  function toggleCell(cellId: string) {
    if (!me || me.confirmed || !hasActiveDiceSelection) return;
    if (!me.selectedColor || !me.selectedNumber) {
      if (!canSelectDice || colorDieIndex === null || numberDieIndex === null || !selectedColor || selectedNumber === null) return;
      playSound('mark');
      onMove({ type: 'select-dice-and-toggle-cell', colorDieIndex, numberDieIndex, color: selectedColor, number: Number(selectedNumber), cellId });
      return;
    }
    playSound(pendingSet.has(cellId) ? 'select' : 'mark');
    onMove({ type: 'toggle-cell', cellId });
  }

  function isCellSelectable(cell: { id: string; color: NochMalColor }) {
    if (!me || me.confirmed || !hasActiveDiceSelection) return false;
    if (me.checkedCells.includes(cell.id)) return false;
    if (selectedColor && cell.color !== selectedColor) return false;
    if (pendingSet.has(cell.id)) return true;
    if (selectedNumber === null || me.pendingCells.length >= Number(selectedNumber)) return false;

    const candidate = [...me.pendingCells, cell.id];
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
  <div class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
    Noch mal läuft über die Party-Lobby, damit Würfelrunde, Spielerstatus, Reconnect und Ergebnis wie bei Skyjo synchron bleiben.
  </div>
{:else}
  {#key nochMalVersion}
  <section class="w-full space-y-4">
    <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800 ring-1 ring-cyan-200">Runde {game.state.round}</span>
            <span class="rounded-md bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{confirmedCount}/{game.players.length} bestätigt</span>
            {#if isAdvantageRound}
              <span class="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200">Startspieler: {activePlayer?.name ?? 'offen'}</span>
            {/if}
            {#if me?.confirmed}
              <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"><Check size={14} /> Bestätigt</span>
            {/if}
          </div>
          <p class="mt-2 min-h-6 text-sm font-medium text-slate-700">{actionText}</p>
        </div>

        {#if me}
          <div class="grid gap-2 text-sm sm:grid-cols-4 xl:min-w-[31rem]">
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Punkte</span><strong>{totalScore}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Joker</span><strong>{remainingJokers}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Spalten</span><strong>{completedColumnScore}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Sterne</span><strong>{starPenalty}</strong></div>
          </div>
        {/if}
      </div>
    </div>

    <div class="grid gap-4 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm sm:p-4 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="order-2 min-w-0 space-y-4 xl:order-1">
{#if me}
          <section class="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Privates Spielblatt</p>
                <h2 class="text-xl font-semibold leading-tight sm:text-2xl">{me.name}</h2>
              </div>
              {#if me.selectedColor && me.selectedNumber}
                <span class="rounded-md bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 ring-1 ring-cyan-200">{colorNames[me.selectedColor]} × {me.selectedNumber}</span>
              {/if}
            </div>

            <div class="touch-scroll-x w-full overscroll-x-contain overflow-x-auto px-1 pt-1 pb-3">
              <div class="mx-auto w-full min-w-[34rem] md:min-w-0 2xl:max-w-[76rem]">
                <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                  {#each letters as letter, index (letter)}
                    <div class="noch-mal-paper grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black text-slate-950 shadow-sm sm:text-base {index === 7 ? 'text-red-500 ring-2 ring-[#e68b2f]' : ''}">{letter}</div>
                  {/each}
                </div>

                <div class="mt-2 overflow-hidden rounded-lg border border-slate-200">
                  <div class="grid grid-cols-[repeat(15,minmax(0,1fr))]">
                    {#each cells as cell (cell.id)}
                      {@const checked = checkedSet.has(cell.id)}
                      {@const pending = pendingSet.has(cell.id)}
                      {@const selectable = isCellSelectable(cell)}
                      <button
                        type="button"
                        aria-label={`Feld ${letters[cell.column]}, Reihe ${cell.row + 1}, ${colorNames[cell.color]}`}
                        aria-pressed={checked}
                        disabled={isLoading || me.confirmed || (!selectable && !pending)}
                        on:click={() => toggleCell(cell.id)}
                        class="relative aspect-square min-w-0 border-b border-r border-slate-900/20 transition focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white disabled:cursor-not-allowed {colorClass[cell.color]} {selectable ? 'hover:brightness-110' : ''} {pending ? 'z-10 ring-4 ring-inset ring-white' : ''} {!selectable && !checked && me.selectedColor ? 'opacity-45' : ''}"
                      >

                        {#if cell.hasStar}
                          <Star class="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow sm:h-8 sm:w-8 {checked ? 'opacity-25' : ''}" strokeWidth={2.4} />
                        {/if}
                        {#if checked}
                          <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white shadow"></span>
                          <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white shadow"></span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                  {#each topScore as value, index (`top-${index}`)}
                    {@const claimedByMe = isTopColumnClaimedByMe(index)}
                    {@const claimedByOther = isTopColumnClaimedByOther(index)}
                    <div
                      class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black shadow-sm sm:text-base {index === 7 ? 'text-red-500' : 'text-slate-950'} {claimedByMe ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-white' : ''} {claimedByOther ? 'opacity-60' : ''}"
                      title={columnScoreLabel(index, 'top')}
                      aria-label={`${letters[index]} oberer Spaltenwert ${value}: ${columnScoreLabel(index, 'top')}`}
                    >
                      {value}
                      {#if claimedByMe}
                        <span class="pointer-events-none absolute inset-1 rounded-full border-2 border-emerald-500"></span>
                      {:else if claimedByOther}
                        <span class="pointer-events-none absolute left-1/2 top-1/2 h-1 w-[74%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full bg-rose-500/85 shadow-sm"></span>
                      {/if}
                    </div>
                  {/each}
                </div>
                <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                  {#each bottomScore as value, index (`bottom-${index}`)}
                    {@const claimedByMe = isBottomColumnClaimedByMe(index)}
                    <div
                      class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-xs font-black shadow-sm sm:text-base {index === 7 ? 'text-red-500' : 'text-slate-950'} {claimedByMe ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-white' : ''}"
                      title={columnScoreLabel(index, 'bottom')}
                      aria-label={`${letters[index]} unterer Spaltenwert ${value}: ${columnScoreLabel(index, 'bottom')}`}
                    >
                      {value}
                      {#if claimedByMe}
                        <span class="pointer-events-none absolute inset-1 rounded-full border-2 border-emerald-500"></span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </section>
        {/if}
        {#if opponents.length > 0}
          <section class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Mitspieler</p>
                <h2 class="text-lg font-semibold leading-tight text-slate-950">Andere Spielblätter</h2>
              </div>
              <span class="rounded-md bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Live-Stand</span>
            </div>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {#each opponents as player (player.id)}
                <article class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <h3 class="truncate text-sm font-semibold text-slate-950">{player.name}</h3>
                      <p class="text-xs text-slate-500">Punkte: {player.score.total}</p>
                    </div>
                    {#if player.confirmed}
                      <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">fertig</span>
                    {:else}
                      <span class="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">spielt</span>
                    {/if}
                  </div>

                  <div class="overflow-hidden rounded-md border border-slate-200 bg-white p-1">
                    <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px">
                      {#each cells as cell (cell.id)}
                        {@const checked = player.checkedCells.includes(cell.id)}
                        <span
                          class="relative aspect-square min-w-0 rounded-[2px] {colorClass[cell.color]}"
                          title={`${player.name}: ${letters[cell.column]}${cell.row + 1}`}
                          aria-label={`${player.name} Feld ${letters[cell.column]}, Reihe ${cell.row + 1}${checked ? ', angekreuzt' : ''}`}
                        >
                          {#if cell.hasStar}
                            <Star class="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-white/90 {checked ? 'opacity-25' : ''}" strokeWidth={2.4} />
                          {/if}
                          {#if checked}
                            <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0.5 w-3/4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white shadow-sm"></span>
                            <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0.5 w-3/4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white shadow-sm"></span>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  </div>

                  <div class="mt-2 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px">
                    {#each topScore as value, index (`mini-top-${player.id}-${index}`)}
                      {@const claimedByPlayer = isTopColumnClaimedByPlayer(index, player.id)}
                      {@const claimedByOther = isTopColumnClaimedByOtherPlayer(index, player.id)}
                      <span class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-[2px] bg-white text-[0.55rem] font-black text-slate-900 ring-1 ring-slate-200 {claimedByPlayer ? 'ring-2 ring-emerald-300' : ''} {claimedByOther ? 'opacity-55' : ''}">
                        {value}
                        {#if claimedByPlayer}
                          <span class="pointer-events-none absolute inset-0.5 rounded-full border border-emerald-500"></span>
                        {:else if claimedByOther}
                          <span class="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full bg-rose-500/85"></span>
                        {/if}
                      </span>
                    {/each}
                  </div>
                  <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px">
                    {#each bottomScore as value, index (`mini-bottom-${player.id}-${index}`)}
                      {@const claimedByPlayer = isBottomColumnClaimedByPlayer(index, player.id)}
                      <span class="noch-mal-paper relative grid aspect-[1.2/1] place-items-center rounded-[2px] bg-white text-[0.55rem] font-black text-slate-900 ring-1 ring-slate-200 {claimedByPlayer ? 'ring-2 ring-emerald-300' : ''}">
                        {value}
                        {#if claimedByPlayer}
                          <span class="pointer-events-none absolute inset-0.5 rounded-full border border-emerald-500"></span>
                        {/if}
                      </span>
                    {/each}
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <aside class="order-1 space-y-3 xl:order-2 xl:sticky xl:top-4 xl:self-start">
        <section class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-1">
            <div>
              <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Farbwürfel</p>
              <div class="grid grid-cols-3 gap-2">
                {#each game.state.roll.colorDice as die, index (`color-${game.state.roll.id}-${index}`)}
                  {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && !activePlayerSkipped && index === game.state.activeColorDieIndex}
                  <button
                    type="button"
                    disabled={isLoading || me?.confirmed || !canChooseDiceThisRound || !isColorDieAvailable(index) || Boolean(me?.selectedColor)}
                    on:click={() => chooseColorDie(index)}
                    class="grid aspect-square min-h-12 touch-manipulation place-items-center rounded-lg border text-sm font-black shadow-sm transition active:scale-95 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 {removedByActive ? 'hidden' : ''} {die === 'joker' ? 'border-slate-300 bg-white text-slate-950' : `${colorClass[die]} border-slate-200`} {colorDieIndex === index || me?.selectedColorDieIndex === index ? 'ring-4 ring-cyan-300' : ''}"
                    aria-label={`Farbwürfel ${index + 1}: ${colorDieLabel(die)}`}
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

            <div>
              <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Zahlenwürfel</p>
              <div class="grid grid-cols-3 gap-2">
                {#each game.state.roll.numberDice as die, index (`number-${game.state.roll.id}-${index}`)}
                  {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && !activePlayerSkipped && index === game.state.activeNumberDieIndex}
                  <button
                    type="button"
                    disabled={isLoading || me?.confirmed || !canChooseDiceThisRound || !isNumberDieAvailable(index) || Boolean(me?.selectedNumber)}
                    on:click={() => chooseNumberDie(index)}
                    class="grid aspect-square min-h-12 touch-manipulation place-items-center rounded-lg border border-slate-300 bg-white text-lg font-black text-slate-950 shadow-sm transition active:scale-95 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 sm:text-xl {removedByActive ? 'hidden' : ''} {numberDieIndex === index || me?.selectedNumberDieIndex === index ? 'ring-4 ring-cyan-300' : ''}"
                    aria-label={`Zahlenwürfel ${index + 1}: ${numberDieLabel(die)}`}
                  >{numberDieLabel(die)}</button>
                {/each}
              </div>
            </div>

            <div class="col-span-2 grid gap-2 sm:grid-cols-2 xl:col-span-1 xl:grid-cols-1 2xl:grid-cols-2">
              {#if selectedColorFace === 'joker'}
                <label class="block text-sm font-semibold text-slate-700">
                  Jokerfarbe
                  <select bind:value={jokerColor} class="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950 focus:outline-none focus:ring-4 focus:ring-cyan-100">
                    {#each colors as color (color)}
                      <option value={color}>{colorNames[color]}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if selectedNumberFace === 'joker'}
                <label class="block text-sm font-semibold text-slate-700">
                  Jokerzahl
                  <select bind:value={jokerNumber} class="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950 focus:outline-none focus:ring-4 focus:ring-cyan-100">
                    {#each [1, 2, 3, 4, 5] as value (value)}
                      <option value={value}>{value}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if currentJokerCost > 0}
                <div class="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                  Joker kostet: {currentJokerCost} - übrig danach: {remainingJokers}
                </div>
              {/if}
              <button type="button" disabled={!canSelectDice || isLoading} on:click={selectDice} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                <Sparkles size={17} /> Auswahl übernehmen
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-900">Aktionen</h3>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={!me || me.confirmed || isLoading} on:click={clearSelection} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={17} /> Auswahl leeren</button>
            <button type="button" disabled={!canConfirm || isLoading} on:click={confirmTurn} class="order-first col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"><Check size={17} /> Zug bestätigen</button>
            <button type="button" disabled={!me || me.confirmed || isLoading} on:click={skipTurn} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"><CircleHelp size={17} /> Kein Zug möglich</button>
          </div>
        </section>
        {#if me}
          <section class="hidden rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm shadow-sm xl:block">
            <h3 class="font-semibold text-slate-900">Wertung</h3>
            <div class="mt-3 space-y-2">
              <div class="flex justify-between gap-3"><span class="text-slate-500">Spalten</span><strong>{completedColumnScore}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-slate-500">Farben</span><strong>{colorBonus}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-slate-500">Joker</span><strong>{jokerPenalty}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-slate-500">Sterne</span><strong>{starPenalty}</strong></div>
              <div class="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base"><span>Total</span><strong>{totalScore}</strong></div>
            </div>
          </section>
        {/if}
      </aside>
    </div>
  </section>
  {/key}
{/if}

{#if activeAchievement}
  <button
    type="button"
    class="fixed inset-0 z-[95] cursor-default bg-slate-950/15"
    on:click={() => closeAchievement()}
    aria-label="Erfolgsmeldung schließen"
  ></button>
  <div
    class="fixed left-1/2 top-1/2 z-[96] w-[min(calc(100vw-2rem),27rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-lg"
    role="dialog"
    aria-live="polite"
    aria-label="Neuer Bonus"
  >
    <div class="relative p-6 sm:p-7">
      <button
        type="button"
        on:click={() => closeAchievement()}
        class="absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-100"
        aria-label="Schließen"
      >
        <X size={20} />
      </button>

      <div class="flex items-start gap-4 pr-9">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
          <Info size={22} strokeWidth={2} />
        </span>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500">Hinweis</p>
          <h2 class="mt-1 text-lg font-semibold leading-snug sm:text-xl">{activeAchievement.playerId === currentPlayerId ? 'Du hast' : `${activeAchievement.playerName} hat`} {activeAchievement.title}.</h2>
          <p class="mt-2 text-sm text-slate-500">{activeAchievement.detail}: +{activeAchievement.points} Punkte</p>
        </div>
      </div>

      {#if achievementQueue.length > 0}<p class="mt-4 border-t border-slate-100 pt-3 text-right text-xs text-slate-500">{achievementQueue.length} weitere Meldung{achievementQueue.length === 1 ? '' : 'en'}</p>{/if}
    </div>
  </div>
{/if}



















