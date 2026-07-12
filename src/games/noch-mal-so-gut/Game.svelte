<script lang="ts">
  import { browser } from '$app/environment';
  import { HelpCircle, Save } from '@lucide/svelte';
  import type { BoardCell, CellColor, NochMalGameState, NochMalSettings } from './types.ts';
  import { colorLabels } from './data/gameConfig.ts';
  import { createGame, rollCurrentDice, selectDice, selectCells, confirmMove, clearPendingMove, skipMove, restartGame, serializeGame, loadGame } from './logic/gameState.ts';
  import { getValidMoves, explainSelection } from './logic/moves.ts';
  import { getAiChoice } from './logic/ai.ts';
  import GameBoard from './components/GameBoard.svelte';
  import DiceArea from './components/DiceArea.svelte';
  import PlayerPanel from './components/PlayerPanel.svelte';
  import ScorePanel from './components/ScorePanel.svelte';
  import TurnIndicator from './components/TurnIndicator.svelte';
  import GameControls from './components/GameControls.svelte';
  import RulesDialog from './components/RulesDialog.svelte';

  type PartySession = { id: string; gameId: string; status: string; state: NochMalGameState & { winnerId?: string | null; isDraw?: boolean } };

  export let game: PartySession | null = null;
  export let currentPlayerId = '';
  export let isLoading = false;
  export let onMove: (move: Record<string, unknown>) => void = () => {};
  export let onGameFinished: (result: { status: 'won' | 'lost' | 'draw' | 'cancelled'; winnerId?: string; winnerName?: string; title?: string; message?: string; score?: number; metadata?: Record<string, unknown> }) => void = () => {};

  let localState = createGame();
  let selectedColorDieId = '';
  let selectedNumberDieId = '';
  let colorChoice: CellColor = 'yellow';
  let numberChoice = 1;
  let selectedCellIds: string[] = [];
  let visiblePlayerId = 'player-1';
  let rulesOpen = false;
  let setupOpen = true;
  let playerCount = 1;
  let aiPlayers = 0;
  let playerNames = ['Spieler 1'];
  let saveMessage = '';
  let finishedReportedFor = '';

  $: state = game?.state ?? localState;
  $: partyMode = Boolean(game);
  $: actingPlayer = state.players[state.actingPlayerIndex];
  $: activePlayer = state.players[state.activePlayerIndex];
  $: visiblePlayer = state.players.find((player) => player.id === visiblePlayerId) ?? actingPlayer ?? state.players[0];
  $: if (actingPlayer && (!visiblePlayerId || visiblePlayerId === 'player-1' || partyMode)) visiblePlayerId = partyMode && currentPlayerId ? currentPlayerId : actingPlayer.id;
  $: selectedDice = state.selectedDice;
  $: validMoves = selectedDice && actingPlayer ? getValidMoves(actingPlayer.board, selectedDice, state.layout, actingPlayer.usedJokers) : [];
  $: selectableIds = [...new Set(validMoves.flatMap((move) => move.cellIds))];
  $: hint = explainSelection(actingPlayer?.board ?? [], selectedCellIds, selectedDice, state.layout, actingPlayer?.usedJokers ?? 0);
  $: disabledColorIds = state.currentRoll?.colorDice.filter((die) => die.reservedBy && die.reservedBy !== actingPlayer?.id).map((die) => die.id) ?? [];
  $: disabledNumberIds = state.currentRoll?.numberDice.filter((die) => die.reservedBy && die.reservedBy !== actingPlayer?.id).map((die) => die.id) ?? [];
  $: if (state.phase === 'finished' && state.finishedAt && finishedReportedFor !== state.finishedAt) reportFinished();

  function applyLocal(next: NochMalGameState) {
    localState = next;
  }

  function sendOrApply(type: string, payload: Record<string, unknown> = {}) {
    if (partyMode) {
      onMove({ type, ...payload });
      return;
    }

    if (type === 'roll') applyLocal(rollCurrentDice(localState));
    if (type === 'select-dice') applyLocal(selectDice(localState, String(payload.colorDieId), String(payload.numberDieId), { colorChoice, numberChoice }));
    if (type === 'select-cells') applyLocal(selectCells(localState, payload.cellIds as string[]));
    if (type === 'confirm') applyLocal(confirmMove(localState));
    if (type === 'clear') applyLocal(clearPendingMove(localState));
    if (type === 'skip') applyLocal(skipMove(localState));
    if (type === 'restart') {
      applyLocal(restartGame(localState));
      selectedCellIds = [];
      selectedColorDieId = '';
      selectedNumberDieId = '';
      finishedReportedFor = '';
    }
  }

  function startLocalGame() {
    const names = Array.from({ length: playerCount }, (_, index) => playerNames[index]?.trim() || `Spieler ${index + 1}`);
    const settings: Partial<NochMalSettings> = { playerCount, playerNames: names, aiPlayers };
    localState = createGame(settings);
    visiblePlayerId = 'player-1';
    selectedCellIds = [];
    selectedColorDieId = '';
    selectedNumberDieId = '';
    setupOpen = false;
  }

  function roll() {
    selectedCellIds = [];
    selectedColorDieId = '';
    selectedNumberDieId = '';
    sendOrApply('roll');
  }

  function chooseColorDie(id: string) {
    selectedColorDieId = id;
    maybeSelectDice();
  }

  function chooseNumberDie(id: string) {
    selectedNumberDieId = id;
    maybeSelectDice();
  }

  function maybeSelectDice() {
    if (!selectedColorDieId || !selectedNumberDieId) return;
    selectedCellIds = [];
    sendOrApply('select-dice', { colorDieId: selectedColorDieId, numberDieId: selectedNumberDieId, colorChoice, numberChoice });
  }

  function chooseCell(cell: BoardCell) {
    if (!selectedDice || cell.marked || cell.color !== selectedDice.color) return;
    const exists = selectedCellIds.includes(cell.id);
    const next = exists ? selectedCellIds.filter((id) => id !== cell.id) : [...selectedCellIds, cell.id].slice(-selectedDice.count);
    selectedCellIds = next;
    sendOrApply('select-cells', { cellIds: next });
  }

  function confirm() {
    sendOrApply('confirm');
    selectedCellIds = [];
  }

  function suggestMove() {
    const suggestion = validMoves[0];
    if (!suggestion) return;
    selectedCellIds = suggestion.cellIds;
    sendOrApply('select-cells', { cellIds: suggestion.cellIds });
  }

  function cancel() {
    selectedCellIds = [];
    sendOrApply('clear');
  }

  function skip() {
    selectedCellIds = [];
    sendOrApply('skip');
  }

  function saveLocalGame() {
    if (!browser || partyMode) return;
    localStorage.setItem('noch-mal-so-gut:save', JSON.stringify(serializeGame(localState)));
    saveMessage = 'Spiel gespeichert.';
  }

  function loadLocalSave() {
    if (!browser || partyMode) return;
    try {
      const raw = localStorage.getItem('noch-mal-so-gut:save');
      if (!raw) return;
      localState = loadGame(JSON.parse(raw));
      setupOpen = false;
      saveMessage = 'Spiel geladen.';
    } catch (error) {
      saveMessage = error instanceof Error ? error.message : 'Spielstand konnte nicht geladen werden.';
    }
  }

  function reportFinished() {
    finishedReportedFor = state.finishedAt ?? '';
    const winner = state.rankings[0];
    const tied = state.rankings.filter((ranking) => ranking.rank === 1);
    if (!winner) return;
    onGameFinished({
      status: tied.length > 1 ? 'draw' : winner.playerId === currentPlayerId || !currentPlayerId ? 'won' : 'lost',
      winnerId: tied.length === 1 ? winner.playerId : undefined,
      winnerName: tied.map((ranking) => ranking.name).join(', '),
      title: tied.length > 1 ? 'Gleichstand' : `${winner.name} gewinnt`,
      message: tied.length > 1 ? `Gleichstand mit ${winner.score} Punkten.` : `Mit ${winner.score} Punkten.`,
      score: winner.score,
      metadata: { rankings: state.rankings, scoreBreakdowns: state.players.map((player) => ({ playerId: player.id, score: player.score })) }
    });
  }

  function runAiTurn() {
    if (!actingPlayer?.isAi || partyMode || state.phase === 'finished') return;
    if (!state.currentRoll) {
      localState = rollCurrentDice(localState);
      return;
    }
    const choice = getAiChoice(localState);
    if (!choice) {
      localState = skipMove(localState);
      return;
    }
    let next = selectDice(localState, choice.selectedDice.colorDieId, choice.selectedDice.numberDieId, { colorChoice: choice.selectedDice.color, numberChoice: choice.selectedDice.count });
    next = selectCells(next, choice.move.cellIds);
    localState = confirmMove(next);
  }
</script>

<div class="space-y-4">
  {#if setupOpen && !partyMode}
    <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Wuerfel- und Strategiespiel</p>
          <h1 class="mt-2 text-3xl font-semibold text-slate-950">Noch mal so gut</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Eigenstaendige digitale Roll-and-Write-Umsetzung mit Farbgruppen, Jokern, Spezialwuerfel, Solo und lokalem Mehrspieler.</p>
        </div>
        <button type="button" on:click={() => (rulesOpen = true)} class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700"><HelpCircle size={18} /> Regeln</button>
      </div>
      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <label class="text-sm font-medium text-slate-700">Spielerzahl
          <input type="number" min="1" max="6" bind:value={playerCount} class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label class="text-sm font-medium text-slate-700">KI-Spieler
          <input type="number" min="0" max={Math.max(0, playerCount - 1)} bind:value={aiPlayers} class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label class="text-sm font-medium text-slate-700">Name Spieler 1
          <input bind:value={playerNames[0]} class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" on:click={startLocalGame} class="rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">Spiel starten</button>
        <button type="button" on:click={loadLocalSave} class="inline-flex items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-5 py-3 font-semibold text-cyan-900"><Save size={18} /> Laden</button>
      </div>
      {#if saveMessage}<p class="mt-3 text-sm text-slate-600">{saveMessage}</p>{/if}
    </section>
  {/if}

  <TurnIndicator round={state.round} phase={state.phase} activeName={activePlayer?.name ?? ''} actingName={actingPlayer?.name ?? ''} />

  {#if actingPlayer?.isAi && !partyMode && state.phase !== 'finished'}
    <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <p class="font-semibold">KI ist am Zug</p>
      <button type="button" on:click={runAiTurn} class="mt-3 rounded-md bg-amber-600 px-4 py-2 font-semibold text-white">KI-Zug ausfuehren</button>
    </div>
  {/if}

  <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="space-y-4">
      <GameBoard board={visiblePlayer.board} layout={state.layout} selectableIds={visiblePlayer.id === actingPlayer?.id ? selectableIds : []} selectedIds={selectedCellIds} showSymbols={state.settings.colorSymbols} onCellClick={chooseCell} />
      {#if state.phase === 'finished'}
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <h2 class="text-2xl font-semibold">Spiel beendet</h2>
          <p class="mt-2">{state.rankings.filter((ranking) => ranking.rank === 1).map((ranking) => ranking.name).join(', ')} gewinnt mit {state.rankings[0]?.score ?? 0} Punkten.</p>
        </div>
      {/if}
    </div>

    <aside class="space-y-4">
      <PlayerPanel players={state.players} activePlayerId={activePlayer?.id ?? ''} actingPlayerId={actingPlayer?.id ?? ''} onSelectPlayer={(id) => (visiblePlayerId = id)} />
      <DiceArea
        roll={state.currentRoll}
        {selectedColorDieId}
        {selectedNumberDieId}
        {colorChoice}
        {numberChoice}
        rolling={isLoading}
        {disabledColorIds}
        {disabledNumberIds}
        onRoll={roll}
        onColorSelect={chooseColorDie}
        onNumberSelect={chooseNumberDie}
        onColorChoice={(color) => { colorChoice = color; maybeSelectDice(); }}
        onNumberChoice={(value) => { numberChoice = value; maybeSelectDice(); }}
      />
      <GameControls canConfirm={state.phase === 'confirmingMove'} canUndo={selectedCellIds.length > 0} canSuggest={validMoves.length > 0} message={hint} onConfirm={confirm} onCancel={cancel} onSuggest={suggestMove} onSkip={skip} onRestart={() => sendOrApply('restart')} onSave={saveLocalGame} />
      <ScorePanel player={visiblePlayer} />
      <button type="button" on:click={() => (rulesOpen = true)} class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800"><HelpCircle size={18} /> Regeln und Hilfe</button>
    </aside>
  </div>

  <RulesDialog open={rulesOpen} onClose={() => (rulesOpen = false)} />
</div>




