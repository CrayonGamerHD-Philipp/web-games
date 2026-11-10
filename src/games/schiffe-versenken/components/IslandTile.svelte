<script>
  /**
   * Ein Landfeld. Inselfelder verbinden sich mit ihren Nachbarn zu einer Insel.
   * @typedef {{ t: boolean, r: boolean, b: boolean, l: boolean }} Joins
   */

  /** @type {'island' | 'rock'} */
  export let kind = 'island';
  /** @type {'palm' | 'hut' | 'flowers' | 'lighthouse'} */
  export let deco = 'palm';
  /** @type {Joins} */
  export let joins = { t: false, r: false, b: false, l: false };

  // Sand reicht bis an den Rand, wo die Insel weitergeht; sonst bleibt ein Wasserrand.
  $: sx = joins.l ? 0 : 8;
  $: sy = joins.t ? 0 : 8;
  $: sw = 100 - sx - (joins.r ? 0 : 8);
  $: sh = 100 - sy - (joins.b ? 0 : 8);
  $: gx = joins.l ? 0 : 16;
  $: gy = joins.t ? 0 : 16;
  $: gw = 100 - gx - (joins.r ? 0 : 16);
  $: gh = 100 - gy - (joins.b ? 0 : 16);
  /** Ecken nur rund, wo zwei offene Seiten aufeinandertreffen. @param {boolean} a @param {boolean} b @param {number} r */
  const corner = (a, b, r) => (a || b ? 0 : r);
  /**
   * Rechteck mit einzelnen Eckradien als Pfad.
   * @param {number} x @param {number} y @param {number} w @param {number} h @param {[number, number, number, number]} radii
   */
  function roundRect(x, y, w, h, [tl, tr, br, bl]) {
    return `M${x + tl} ${y} H${x + w - tr} Q${x + w} ${y} ${x + w} ${y + tr} V${y + h - br} Q${x + w} ${y + h} ${x + w - br} ${y + h} H${x + bl} Q${x} ${y + h} ${x} ${y + h - bl} V${y + tl} Q${x} ${y} ${x + tl} ${y} Z`;
  }
  $: sand = roundRect(sx, sy, sw, sh, [corner(joins.t, joins.l, 24), corner(joins.t, joins.r, 24), corner(joins.b, joins.r, 24), corner(joins.b, joins.l, 24)]);
  $: grass = roundRect(gx, gy, gw, gh, [corner(joins.t, joins.l, 18), corner(joins.t, joins.r, 18), corner(joins.b, joins.r, 18), corner(joins.b, joins.l, 18)]);
</script>

<svg class="tile" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
  {#if kind === 'rock'}
    <circle cx="50" cy="54" r="40" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.6" />
    <path d="M22 66 C18 50 28 32 46 28 C64 24 82 38 80 58 C78 72 62 78 46 76 C34 75 25 73 22 66 Z" fill="#9aa3ad" stroke="#4f5964" stroke-width="4" stroke-linejoin="round" />
    <path d="M36 44 C40 38 48 35 54 36" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.5" />
    <path d="M54 54 C62 52 68 56 70 62" fill="none" stroke="#6f7883" stroke-width="3" stroke-linecap="round" />
    <path d="M28 68 q4 -6 8 0 q4 -6 8 0" fill="none" stroke="#6fae43" stroke-width="3" stroke-linecap="round" />
  {:else}
    <path d={sand} fill="#f2d79b" stroke="#c49a4f" stroke-width="2" />
    <path d={grass} fill="#8ccf5f" />
    {#if deco === 'palm'}
      <ellipse cx="54" cy="74" rx="16" ry="5" fill="#2f4a1d" opacity="0.2" />
      <path d="M50 74 C50 60 52 46 58 36" fill="none" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round" />
      <path d="M58 36 C46 28 34 30 28 38 M58 36 C66 24 78 24 84 30 M58 36 C70 36 78 44 80 54 M58 36 C50 40 44 50 44 58" fill="none" stroke="#3d8a3a" stroke-width="8" stroke-linecap="round" />
      <circle cx="56" cy="40" r="4" fill="#8a5a2b" />
      <circle cx="62" cy="41" r="4" fill="#8a5a2b" />
    {:else if deco === 'hut'}
      <ellipse cx="50" cy="74" rx="20" ry="5" fill="#2f4a1d" opacity="0.2" />
      <rect x="34" y="48" width="32" height="24" rx="3" fill="#e9c58a" stroke="#8a5a2b" stroke-width="3" />
      <path d="M28 50 L50 30 L72 50 Z" fill="#c9784a" stroke="#6b4319" stroke-width="3" stroke-linejoin="round" />
      <rect x="45" y="58" width="10" height="14" rx="2" fill="#8a5a2b" />
    {:else if deco === 'lighthouse'}
      <ellipse cx="50" cy="78" rx="18" ry="5" fill="#2f4a1d" opacity="0.2" />
      <path d="M40 76 L44 34 L56 34 L60 76 Z" fill="#ffffff" stroke="#8c262f" stroke-width="3" stroke-linejoin="round" />
      <path d="M42 62 L58 62 L59 70 L41 70 Z M43 46 L57 46 L57.6 54 L42.4 54 Z" fill="#e25a4f" />
      <rect x="42" y="24" width="16" height="10" rx="2" fill="#ffe28a" stroke="#8c262f" stroke-width="3" />
      <path d="M40 24 L50 16 L60 24 Z" fill="#e25a4f" stroke="#8c262f" stroke-width="3" stroke-linejoin="round" />
      <path d="M62 28 L80 22 M62 30 L80 34" stroke="#ffe28a" stroke-width="3" stroke-linecap="round" opacity="0.9" />
    {:else}
      <g>
        <circle cx="36" cy="42" r="5" fill="#ffffff" /><circle cx="36" cy="42" r="2.2" fill="#f2b530" />
        <circle cx="62" cy="36" r="5" fill="#f08a8a" /><circle cx="62" cy="36" r="2.2" fill="#ffe28a" />
        <circle cx="54" cy="62" r="5" fill="#ffffff" /><circle cx="54" cy="62" r="2.2" fill="#f2b530" />
        <circle cx="30" cy="64" r="4" fill="#b9a7ef" /><circle cx="30" cy="64" r="1.8" fill="#ffe28a" />
        <path d="M70 66 q4 -8 8 0 M66 52 q3 -6 6 0" fill="none" stroke="#3d8a3a" stroke-width="2.5" stroke-linecap="round" />
      </g>
    {/if}
  {/if}
</svg>

<style>
  .tile {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
