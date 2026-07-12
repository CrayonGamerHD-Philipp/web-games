<script lang="ts">
  export let open = false;
  export let onClose: () => void = () => {};
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:items-center">
    <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-2xl font-semibold text-slate-950">Regeln</h2>
        <button type="button" on:click={onClose} class="rounded-md border border-slate-300 px-3 py-1 font-semibold">Schliessen</button>
      </div>
      <div class="mt-4 space-y-3 text-sm leading-6 text-slate-700">
        <p>Ziel ist die hoechste Punktzahl. Markiere zusammenhaengende Felder gleicher Farbe passend zu einer Kombination aus Farb- und Zahlenwuerfel.</p>
        <p>Der erste Eintrag muss die Startspalte H beruehren. Spaetere Eintraege muessen an eigene Markierungen anschliessen oder ebenfalls in H beginnen.</p>
        <p>Joker auf Farb- oder Zahlenwuerfeln koennen frei gewaehlt werden, verbrauchen aber eines der acht Jokerfelder. Ueberzaehlige Joker kosten Punkte.</p>
        <p>In den ersten drei Runden duerfen alle Spieler dieselben Wuerfel nutzen. Danach verwenden passive Spieler nur die nicht reservierten Wuerfel.</p>
        <p>Spalten, Reihen und vollstaendige Farben bringen Punkte. Nicht markierte Sterne geben Minuspunkte. Das Spiel endet, wenn ein Spieler mehrere grosse Bereiche vollendet oder im Solo nach 30 Runden.</p>
      </div>
    </div>
  </div>
{/if}


