<script lang="ts">
  import type { BoardCell, BoardLayout } from '../types.ts';
  import GameBoard from './GameBoard.svelte';

  export let board: BoardCell[][];
  export let layout: BoardLayout;
  export let selectableIds: string[] = [];
  export let selectedIds: string[] = [];
  export let showSymbols = true;
  export let onCellClick: (cell: BoardCell) => void = () => {};
</script>

<GameBoard {board} {layout} {selectableIds} {selectedIds} {showSymbols} {onCellClick} />
