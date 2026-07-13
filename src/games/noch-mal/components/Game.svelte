<script lang="ts">
  import { Check, CircleHelp, RotateCcw, Sparkles } from '@lucide/svelte';
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
  const colorSymbols: Record<NochMalColor, string> = {
    lime: '◆',
    yellow: '●',
    blue: '■',
    pink: '✦',
    peach: '⬟'
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
  $: completedColumnScore = me ? bottomScore.reduce((sum, value, column) => sum + (rows.every((_, row) => me.checkedCells.includes(`${row}-${column}`)) ? value : 0), 0) : 0;
  $: starPenalty = me ? cells.filter((cell) => cell.hasStar && !me.checkedCells.includes(cell.id)).length * -2 : 0;
  $: colorBonus = me?.score.colorPoints ?? 0;
  $: totalScore = me?.score.total ?? completedColumnScore + colorBonus + starPenalty - (me?.usedJokers ?? 0);
  $: confirmedCount = game?.state.confirmedPlayerIds.length ?? 0;
  $: activePlayer = game?.players.find((player) => player.id === game.state.activePlayerId) ?? null;
  $: isAdvantageRound = Boolean(game && game.state.round >= 4);
  $: activeSelectionDone = Boolean(game && game.state.activeColorDieIndex !== null && game.state.activeNumberDieIndex !== null);
  $: isActivePlayer = Boolean(me && game?.state.activePlayerId === me.id);
  $: isPassiveWaiting = Boolean(isAdvantageRound && !isActivePlayer && !activeSelectionDone);
  $: canChooseDiceThisRound = Boolean(me && !me.confirmed && (!isAdvantageRound || isActivePlayer || activeSelectionDone));
  $: hasLocalDiceSelection = Boolean(me && roll && canChooseDiceThisRound && colorDieIndex !== null && numberDieIndex !== null && selectedColor && selectedNumber !== null && isColorDieAvailable(colorDieIndex) && isNumberDieAvailable(numberDieIndex));
  $: hasActiveDiceSelection = Boolean(me && !me.confirmed && ((me.selectedColor && me.selectedNumber) || hasLocalDiceSelection));
  $: canSelectDice = Boolean(hasLocalDiceSelection && !me?.selectedColor && !me?.selectedNumber);
  $: canConfirm = Boolean(me && !me.confirmed && me.selectedColor && me.selectedNumber && me.pendingCells.length === me.selectedNumber && isConnectedGroup(me.pendingCells) && hasValidAnchor(me, me.pendingCells));
  $: actionText = getActionText();

  function getActionText() {
    if (!game) return 'Noch mal wird über eine Party gestartet.';
    if (!me) return 'Du schaust diese Runde zu.';
    if (game.status === 'finished' || game.state.phase === 'finished') return 'Die Partie ist beendet.';
    if (me.confirmed) return 'Zug bestätigt. Warte auf die anderen Spieler.';
    if (isPassiveWaiting) return `Warte auf die Auswahl von ${activePlayer?.name ?? 'dem Startspieler'}.`;
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

  function playSound(name: SoundName) {
    if (!soundEnabled) return;

    const audio = getAudio(name);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
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
    if (!isAdvantageRound || isActivePlayer) return true;
    return activeSelectionDone && index !== game.state.activeColorDieIndex;
  }

  function isNumberDieAvailable(index: number | null) {
    if (index === null || !game) return false;
    if (!isAdvantageRound || isActivePlayer) return true;
    return activeSelectionDone && index !== game.state.activeNumberDieIndex;
  }

  function chooseColorDie(index: number) {
    if (!isColorDieAvailable(index) || !canChooseDiceThisRound) return;
    playSound('select');
    colorDieIndex = index;
    if (numberDieIndex !== null) setTimeout(selectDice, 0);
  }

  function chooseNumberDie(index: number) {
    if (!isNumberDieAvailable(index) || !canChooseDiceThisRound) return;
    playSound('select');
    numberDieIndex = index;
    if (colorDieIndex !== null) setTimeout(selectDice, 0);
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
          <button
            type="button"
            on:click={() => {
              soundEnabled = !soundEnabled;
              if (soundEnabled) playSound('select');
            }}
            class="mt-2 inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
            aria-pressed={soundEnabled}
          >
            Sound {soundEnabled ? 'an' : 'aus'}
          </button>
        </div>

        {#if me}
          <div class="grid gap-2 text-sm sm:grid-cols-4 xl:min-w-[31rem]">
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Punkte</span><strong>{totalScore}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Joker</span><strong>{jokerCount - me.usedJokers}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Spalten</span><strong>{completedColumnScore}</strong></div>
            <div class="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"><span class="block text-xs text-slate-500">Sterne</span><strong>{starPenalty}</strong></div>
          </div>
        {/if}
      </div>
    </div>

    <div class="grid gap-4 rounded-lg border border-slate-200 bg-slate-950 p-3 text-white shadow-sm sm:p-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="min-w-0 space-y-4">
        <section class="rounded-lg border border-white/10 bg-white/5 p-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-3">
              <div>
                <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55">Farbwürfel</p>
                <div class="flex flex-wrap gap-2">
                  {#each game.state.roll.colorDice as die, index (`color-${game.state.roll.id}-${index}`)}
                    {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && index === game.state.activeColorDieIndex}
                    <button
                      type="button"
                      disabled={isLoading || me?.confirmed || !canChooseDiceThisRound || !isColorDieAvailable(index) || Boolean(me?.selectedColor)}
                      on:click={() => chooseColorDie(index)}
                      class="grid h-14 w-14 place-items-center rounded-lg border text-sm font-black shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 {removedByActive ? 'hidden' : ''} {die === 'joker' ? 'border-white/40 bg-white text-slate-950' : `${colorClass[die]} border-white/20`} {colorDieIndex === index || me?.selectedColorDieIndex === index ? 'ring-4 ring-cyan-300' : ''}"
                      aria-label={`Farbwürfel ${index + 1}: ${colorDieLabel(die)}`}
                    >{die === 'joker' ? '?' : colorSymbols[die]}</button>
                  {/each}
                </div>
              </div>

              <div>
                <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55">Zahlenwürfel</p>
                <div class="flex flex-wrap gap-2">
                  {#each game.state.roll.numberDice as die, index (`number-${game.state.roll.id}-${index}`)}
                    {@const removedByActive = isAdvantageRound && activeSelectionDone && !isActivePlayer && index === game.state.activeNumberDieIndex}
                    <button
                      type="button"
                      disabled={isLoading || me?.confirmed || !canChooseDiceThisRound || !isNumberDieAvailable(index) || Boolean(me?.selectedNumber)}
                      on:click={() => chooseNumberDie(index)}
                      class="grid h-14 w-14 place-items-center rounded-lg border border-white/30 bg-white text-xl font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 {removedByActive ? 'hidden' : ''} {numberDieIndex === index || me?.selectedNumberDieIndex === index ? 'ring-4 ring-cyan-300' : ''}"
                      aria-label={`Zahlenwürfel ${index + 1}: ${numberDieLabel(die)}`}
                    >{numberDieLabel(die)}</button>
                  {/each}
                </div>
              </div>
            </div>

            <div class="grid gap-2 sm:grid-cols-2 lg:w-[24rem]">
              {#if selectedColorFace === 'joker'}
                <label class="block text-sm font-semibold text-white/80">
                  Jokerfarbe
                  <select bind:value={jokerColor} class="mt-1 min-h-11 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white focus:outline-none focus:ring-4 focus:ring-cyan-200/30">
                    {#each colors as color (color)}
                      <option value={color}>{colorNames[color]}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if selectedNumberFace === 'joker'}
                <label class="block text-sm font-semibold text-white/80">
                  Jokerzahl
                  <select bind:value={jokerNumber} class="mt-1 min-h-11 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white focus:outline-none focus:ring-4 focus:ring-cyan-200/30">
                    {#each [1, 2, 3, 4, 5] as value (value)}
                      <option value={value}>{value}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              <button type="button" disabled={!canSelectDice || isLoading} on:click={selectDice} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-2 font-semibold text-white transition hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
                <Sparkles size={18} /> Auswahl übernehmen
              </button>
            </div>
          </div>
        </section>

        {#if me}
          <section class="overflow-hidden rounded-lg border border-white/10 bg-[#0b1b22] p-2 sm:p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#e68b2f]">Privates Spielblatt</p>
                <h2 class="text-xl font-semibold leading-tight sm:text-2xl">{me.name}</h2>
              </div>
              {#if me.selectedColor && me.selectedNumber}
                <span class="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/15">{colorNames[me.selectedColor]} × {me.selectedNumber}</span>
              {/if}
            </div>

            <div class="w-full overflow-x-auto pb-2">
              <div class="mx-auto min-w-[46rem] max-w-[100rem]">
                <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
                  {#each letters as letter, index (letter)}
                    <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black text-slate-950 shadow-sm sm:text-lg {index === 7 ? 'text-red-500 ring-2 ring-[#e68b2f]' : ''}">{letter}</div>
                  {/each}
                </div>

                <div class="mt-2 overflow-hidden rounded-lg border border-white/15">
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
                        class="relative aspect-square min-w-0 border-b border-r border-slate-950/20 transition focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white disabled:cursor-not-allowed {colorClass[cell.color]} {selectable ? 'hover:brightness-110' : ''} {pending ? 'z-10 ring-4 ring-inset ring-white' : ''} {!selectable && !checked && me.selectedColor ? 'opacity-45' : ''}"
                      >
                        <span class="pointer-events-none absolute left-1 top-1 text-[0.65rem] font-black opacity-70">{colorSymbols[cell.color]}</span>
                        {#if cell.hasStar}
                          <span class="pointer-events-none absolute inset-0 grid place-items-center text-xl font-black text-white drop-shadow sm:text-3xl {checked ? 'opacity-25' : ''}">☆</span>
                        {/if}
                        {#if checked}
                          <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white shadow"></span>
                          <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white shadow"></span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
                  {#each topScore as value, index (`top-${index}`)}
                    <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black shadow-sm sm:text-lg {index === 7 ? 'text-red-500' : 'text-slate-950'}">{value}</div>
                  {/each}
                </div>
                <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
                  {#each bottomScore as value, index (`bottom-${index}`)}
                    <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black shadow-sm sm:text-lg {index === 7 ? 'text-red-500' : 'text-slate-950'}">{value}</div>
                  {/each}
                </div>
              </div>
            </div>
          </section>
        {/if}
      </div>

      <aside class="space-y-3">
        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
          <h3 class="text-sm font-semibold text-white">Aktionen</h3>
          <div class="mt-3 grid gap-2">
            <button type="button" disabled={!me || me.confirmed || isLoading} on:click={clearSelection} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={17} /> Auswahl leeren</button>
            <button type="button" disabled={!canConfirm || isLoading} on:click={confirmTurn} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"><Check size={17} /> Zug bestätigen</button>
            <button type="button" disabled={!me || me.confirmed || isLoading} on:click={skipTurn} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"><CircleHelp size={17} /> Kein Zug möglich</button>
          </div>
        </div>

        {#if me}
          <div class="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <h3 class="font-semibold text-white">Wertung</h3>
            <div class="mt-3 space-y-2">
              <div class="flex justify-between gap-3"><span class="text-white/65">Spalten</span><strong>{completedColumnScore}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-white/65">Farben</span><strong>{colorBonus}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-white/65">Joker</span><strong>-{me.usedJokers}</strong></div>
              <div class="flex justify-between gap-3"><span class="text-white/65">Sterne</span><strong>{starPenalty}</strong></div>
              <div class="border-t border-white/10 pt-2 text-base flex justify-between gap-3"><span>Total</span><strong>{totalScore}</strong></div>
            </div>
          </div>
        {/if}

        <div class="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          <h3 class="font-semibold text-white">Spieler</h3>
          <div class="mt-3 space-y-2">
            {#each game.players as player (player.id)}
              <div class="flex items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2">
                <span class="truncate {player.id === currentPlayerId ? 'font-semibold text-cyan-200' : 'text-white/75'}">{player.name}</span>
                {#if player.confirmed}
                  <span class="rounded bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">fertig</span>
                {:else}
                  <span class="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">spielt</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </aside>
    </div>
  </section>
  {/key}
{/if}









