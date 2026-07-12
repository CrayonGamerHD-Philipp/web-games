<script lang="ts">
  import type { SpecialDieResult } from '../types.ts';
  import { specialActionDescriptions, specialActionLabels } from '../data/gameConfig.ts';
  export let die: SpecialDieResult | null = null;
</script>

<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
  <p class="font-semibold text-slate-950">{die ? specialActionLabels[die.value] : 'Spezialwürfel'}</p>
  <p class="mt-1 leading-5">{die ? specialActionDescriptions[die.value] : 'Wuerfle zuerst.'}</p>
</div>


