<script module>
  import { AVATAR_PARTS, normalizeAvatar } from '$lib/party-features.js';

  /** Dunkle Tinte für Gesicht und Umrisse der Extras; auf allen 12 Spielerfarben ≥ 3:1. */
  export const AVATAR_INK = '#17141f';

  /**
   * Stabiler Avatar aus einem Namen (nie zufällig), z. B. wenn ein Spieler noch keinen hat.
   * @param {string | null | undefined} name
   * @returns {import('$lib/party-features.js').Avatar}
   */
  export function avatarFromName(name) {
    let hash = 2166136261;
    for (const char of String(name ?? '').trim().toLowerCase()) {
      hash ^= char.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    let salt = 0;
    // Eigener, gut gemischter Wert pro Teil (murmur3-Finalizer), damit sich Teile nicht gegenseitig bestimmen.
    const take = (/** @type {number} */ count) => {
      let x = (hash + Math.imul(++salt, 0x9e3779b9)) >>> 0;
      x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
      x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
      return ((x ^ (x >>> 16)) >>> 0) % count;
    };
    return { shape: take(AVATAR_PARTS.shape), eyes: take(AVATAR_PARTS.eyes), mouth: take(AVATAR_PARTS.mouth), accessory: take(AVATAR_PARTS.accessory) };
  }

  /** Weiche Sternform: Kreis mit 8 runden Zacken. */
  function starPath() {
    const points = [];
    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2 - Math.PI / 2;
      const radius = 31 + 4.5 * Math.cos(angle * 8);
      points.push(`${(50 + radius * Math.cos(angle)).toFixed(2)} ${(59 + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return `M${points.join(' L')}Z`;
  }

  /**
   * Körperformen. top = Scheitel (für Hüte), face = Versatz des Gesichts, ear = halbe Breite auf Ohrhöhe.
   * @type {{ d: string, top: number, face: number, ear: number }[]}
   */
  const SHAPES = [
    // Klecks
    { d: 'M50 24C72 23 86 38 86 59C86 80 71 92 50 92C29 92 14 80 14 60C14 38 28 25 50 24Z', top: 24, face: 0, ear: 36 },
    // Würfel
    { d: 'M34 25H66C77 25 84 32 84 43V74C84 85 77 91 66 91H34C23 91 16 85 16 74V43C16 32 23 25 34 25Z', top: 25, face: 0, ear: 34 },
    // Bohne
    { d: 'M50 21C66 21 76 32 76 48V68C76 84 66 93 50 93C34 93 24 84 24 68V48C24 32 34 21 50 21Z', top: 21, face: 0, ear: 26 },
    // Gummibonbon (dreieckig)
    { d: 'M50 22C58 22 63 30 69 42C76 56 88 70 88 80C88 89 80 92 70 92H30C20 92 12 89 12 80C12 70 24 56 31 42C37 30 42 22 50 22Z', top: 22, face: 6, ear: 26 },
    // Stern
    { d: starPath(), top: 23, face: 1, ear: 34 },
    // Wolke
    { d: 'M27 91C17 91 12 83 15 74C9 70 9 58 18 54C15 42 25 33 36 37C40 27 54 23 63 31C73 28 84 37 82 48C90 52 91 64 85 70C89 81 82 91 72 91Z', top: 27, face: 2, ear: 36 }
  ];

  /**
   * Gleichmäßig abgedunkelte Umrissfarbe ohne Verlauf.
   * @param {string} hex
   */
  function shade(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
    if (!match) return 'color-mix(in srgb, var(--player) 62%, #000)';
    const value = parseInt(match[1], 16);
    const channel = (/** @type {number} */ shift) => Math.round(((value >> shift) & 255) * 0.62);
    return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
  }
</script>

<script>
  /** @type {import('$lib/party-features.js').Avatar | null | undefined} */
  export let avatar = null;
  /** Spielername (für aria-label und stabilen Fallback-Avatar) */
  export let name = '';
  /** Spielerfarbe als Hex (z. B. aus playerHex) */
  export let color = '#64748b';
  /** Kantenlänge in px */
  export let size = 40;
  /** Hervorhebung, z. B. wer am Zug ist */
  export let active = false;
  /** Rein dekorativ (Name steht daneben): dann aria-hidden */
  export let decorative = true;

  const ink = AVATAR_INK;

  $: parts = avatar ? normalizeAvatar(avatar, avatarFromName(name)) : avatarFromName(name);
  $: body = SHAPES[parts.shape] ?? SHAPES[0];
  $: outline = shade(color);
  $: hatY = body.top - 24;
  $: faceY = body.face;
</script>

<span
  class="player-avatar"
  class:is-active={active}
  style={`--player: ${color}; --size: ${size}px;`}
  role={decorative ? undefined : 'img'}
  aria-hidden={decorative ? 'true' : undefined}
  aria-label={decorative ? undefined : `Avatar von ${name}`}
  data-avatar={`${parts.shape}-${parts.eyes}-${parts.mouth}-${parts.accessory}`}
>
  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
    <!-- Hinter dem Kopf: Hörner und Kopfhörer-Bügel -->
    {#if parts.accessory === 7}
      <g transform={`translate(0 ${hatY})`} stroke={ink} stroke-width="3" stroke-linejoin="round">
        <path d="M30 34C25 27 24 18 28 9C33 15 39 21 42 28Z" fill="#fbecc8" />
        <path d="M70 34C75 27 76 18 72 9C67 15 61 21 58 28Z" fill="#fbecc8" />
      </g>
    {:else if parts.accessory === 3}
      <g transform={`translate(50 ${hatY}) scale(${(body.ear + 8) / 42} 1) translate(-50 0)`}>
        <path d="M14 50C14 24 30 13 50 13C70 13 86 24 86 50" fill="none" stroke={ink} stroke-width="8.5" stroke-linecap="round" />
        <path d="M14 50C14 24 30 13 50 13C70 13 86 24 86 50" fill="none" stroke="#f3eee4" stroke-width="3.5" stroke-linecap="round" />
      </g>
    {/if}

    <path d={body.d} fill={color} stroke={outline} stroke-width="3.5" stroke-linejoin="round" />

    <g transform={`translate(0 ${faceY})`}>
      <!-- Wangen -->
      <ellipse cx="30" cy="67" rx="5.5" ry="3.2" fill="#ffffff" opacity="0.28" />
      <ellipse cx="70" cy="67" rx="5.5" ry="3.2" fill="#ffffff" opacity="0.28" />

      <!-- Augen -->
      {#if parts.eyes === 0}
        {#each [37, 63] as x}
          <circle cx={x} cy="55" r="8.5" fill="#fff" stroke={ink} stroke-width="2" />
          <circle cx={x + 1} cy="56" r="4.6" fill={ink} />
          <circle cx={x + 2.6} cy="54" r="1.5" fill="#fff" />
        {/each}
      {:else if parts.eyes === 1}
        {#each [38, 62] as x}
          <ellipse cx={x} cy="55" rx="5" ry="6.2" fill={ink} />
          <circle cx={x + 1.6} cy="53" r="1.7" fill="#fff" />
        {/each}
      {:else if parts.eyes === 2}
        <path d="M30 57Q37 47 44 57M56 57Q63 47 70 57" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
      {:else if parts.eyes === 3}
        {#each [37, 63] as x}
          <circle cx={x} cy="55" r="8" fill="#fff" stroke={ink} stroke-width="2" />
          <circle cx={x} cy="58" r="4.2" fill={ink} />
          <path d={`M${x - 9} 55A9 9 0 0 1 ${x + 9} 55Z`} fill={outline} stroke={ink} stroke-width="2" stroke-linejoin="round" />
        {/each}
      {:else if parts.eyes === 4}
        <circle cx="37" cy="55" r="8.5" fill="#fff" stroke={ink} stroke-width="2" />
        <circle cx="38" cy="56" r="4.6" fill={ink} />
        <circle cx="39.6" cy="54" r="1.5" fill="#fff" />
        <path d="M57 51L68 56L57 60" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
      {:else}
        {#each [36.5, 63.5] as x}
          <circle cx={x} cy="54" r="10" fill="#fff" stroke={ink} stroke-width="2" />
          <circle cx={x} cy="55" r="6.6" fill={ink} />
          <circle cx={x + 2.4} cy="52" r="2.4" fill="#fff" />
          <circle cx={x - 2.2} cy="58" r="1.2" fill="#fff" />
        {/each}
      {/if}

      <!-- Mund -->
      {#if parts.mouth === 0}
        <path d="M41 69Q50 78 59 69" fill="none" stroke={ink} stroke-width="4" stroke-linecap="round" />
      {:else if parts.mouth === 1}
        <path d="M39 68H61C61 77 56 82 50 82C44 82 39 77 39 68Z" fill={ink} stroke={ink} stroke-width="2" stroke-linejoin="round" />
        <path d="M44 79C46 75 54 75 56 79C54 81 52 82 50 82C48 82 46 81 44 79Z" fill="#f2879b" />
      {:else if parts.mouth === 2}
        <ellipse cx="50" cy="73" rx="4.6" ry="5.6" fill={ink} />
      {:else if parts.mouth === 3}
        <path d="M40 70Q45 76 50 70Q55 76 60 70" fill="none" stroke={ink} stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
      {:else if parts.mouth === 4}
        <path d="M51 71V75A4.5 4.5 0 0 0 60 75V71Z" fill="#f2879b" stroke={ink} stroke-width="2.4" stroke-linejoin="round" />
        <path d="M40 71Q50 74 62 69" fill="none" stroke={ink} stroke-width="3.8" stroke-linecap="round" />
      {:else}
        <rect x="39" y="67" width="22" height="11" rx="5.5" fill="#fff" stroke={ink} stroke-width="2.8" />
        <path d="M46.3 67.5V77.5M53.7 67.5V77.5" stroke={ink} stroke-width="2" />
      {/if}

      {#if parts.accessory === 4}
        <!-- Brille -->
        <g fill="none" stroke={ink} stroke-width="3.4">
          <circle cx="37" cy="55" r="11.5" fill="#ffffff" fill-opacity="0.18" />
          <circle cx="63" cy="55" r="11.5" fill="#ffffff" fill-opacity="0.18" />
          <path d="M48.5 54Q50 51.5 51.5 54M25.5 53L18 50M74.5 53L82 50" stroke-linecap="round" />
        </g>
      {/if}
    </g>

    <!-- Auf dem Kopf -->
    {#if parts.accessory === 1}
      <g transform={`translate(0 ${hatY})`} stroke={ink} stroke-width="3" stroke-linejoin="round">
        <path d="M27 31C27 17 37 9 50 9C63 9 73 17 73 31Z" fill="#fbf7ee" />
        <path d="M50 9C47 15 46 23 47 31" fill="none" stroke-width="2.4" />
        <path d="M60 31H86C88 31 88 37 84 37H60Z" fill="#fbf7ee" />
        <circle cx="50" cy="9" r="2.6" fill={ink} />
      </g>
    {:else if parts.accessory === 2}
      <g transform={`translate(0 ${hatY})`} stroke={ink} stroke-width="3" stroke-linejoin="round">
        <path d="M31 29L29 8L40 17L50 5L60 17L71 8L69 29Z" fill="#fcd34d" />
        <circle cx="50" cy="20" r="3" fill="#f43f5e" stroke-width="2" />
      </g>
    {:else if parts.accessory === 3}
      <g transform={`translate(50 ${hatY}) scale(${(body.ear + 8) / 42} 1) translate(-50 0)`} stroke={ink} stroke-width="3">
        <rect x="7" y="40" width="14" height="24" rx="7" fill="#f3eee4" />
        <rect x="79" y="40" width="14" height="24" rx="7" fill="#f3eee4" />
        <rect x="11.5" y="46" width="5" height="12" rx="2.5" fill="#f472b6" stroke="none" />
        <rect x="83.5" y="46" width="5" height="12" rx="2.5" fill="#f472b6" stroke="none" />
      </g>
    {:else if parts.accessory === 5}
      <g transform={`translate(0 ${hatY})`} stroke={ink} stroke-width="3" stroke-linejoin="round">
        <path d="M66 22L53 13C50 11 47 13 48 17L51 28Z" fill="#f472b6" />
        <path d="M66 22L80 14C83 12 86 15 85 18L81 29Z" fill="#f472b6" />
        <circle cx="66" cy="23" r="5" fill="#ec4899" />
      </g>
    {:else if parts.accessory === 6}
      <g transform={`translate(0 ${hatY}) rotate(-10 50 30)`} stroke={ink} stroke-width="3" stroke-linejoin="round">
        <path d="M33 31L50 10L67 31Q50 36 33 31Z" fill="#a7f3d0" />
        <circle cx="45" cy="25" r="2.6" fill="#f43f5e" stroke="none" />
        <circle cx="53" cy="20" r="2.3" fill="#6366f1" stroke="none" />
        <circle cx="56" cy="28" r="2.3" fill="#f59e0b" stroke="none" />
        <circle cx="50" cy="10" r="4.8" fill="#fde047" />
      </g>
    {/if}
  </svg>
</span>

<style>
  .player-avatar {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    border-radius: 999px;
    line-height: 0;
  }
  .player-avatar svg {
    display: block;
    overflow: visible;
  }
  .player-avatar.is-active {
    box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--accent-main);
  }
</style>
