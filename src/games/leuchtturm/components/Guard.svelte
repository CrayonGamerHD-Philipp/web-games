<svelte:options namespace="svg" />

<script>
  /**
   * Die fünf Wächter – Lichtgeister aus der Moosgeister-Familie (Zeichenfläche 200 × 210).
   */
  /** @type {import('../types').LtRoleId} */
  export let role = 'funzel';

  const COLORS = {
    funzel: { body: '#f5a54a', line: '#8a4b12', light: '#ffd08a' },
    lotti: { body: '#e8796b', line: '#7f2a22', light: '#ffb8ab' },
    sacki: { body: '#6cb552', line: '#2a6334', light: '#a8dc8a' },
    kiek: { body: '#e9eef4', line: '#4f5964', light: '#ffffff' },
    piepser: { body: '#8a7fe0', line: '#3b3280', light: '#c6bff8' }
  };
  const INK = '#13233d';

  $: c = COLORS[role] ?? COLORS.funzel;
</script>

<ellipse cx="100" cy="190" rx="52" ry="9" fill="#13233d" opacity="0.12"></ellipse>
{#if role === 'kiek'}
  <path d="M100 50 C96 38 98 30 104 26 M100 50 C104 40 110 36 116 36" fill="none" stroke={c.line} stroke-width="3" stroke-linecap="round"></path>
{:else if role === 'piepser'}
  <path d="M100 50 L100 20" stroke="#2f3a45" stroke-width="3.5" stroke-linecap="round"></path>
  <circle cx="100" cy="17" r="7" fill="#ff6b6b" stroke="#8a2a2a" stroke-width="2"></circle>
  <path d="M86 14 q-6 4 -6 10 M114 14 q6 4 6 10" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" opacity="0.7"></path>
{/if}
<path d="M100 46 C120 78 148 100 148 134 C148 164 126 182 100 182 C74 182 52 164 52 134 C52 100 80 78 100 46 Z" fill={c.body} stroke={c.line} stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M100 70 C114 92 136 110 136 138 C136 158 120 172 100 172 C80 172 64 158 64 138 C64 110 86 92 100 70 Z" fill={c.light} opacity="0.5"></path>
<path d="M70 124 C72 110 80 98 88 90" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.6"></path>
{#if role === 'kiek'}
  <path d="M58 128 C30 116 14 130 18 146 C30 140 42 146 56 152 Z" fill="#ffffff" stroke={c.line} stroke-width="3" stroke-linejoin="round"></path>
  <path d="M26 138 q8 -2 14 2 M30 146 q6 -1 10 2" fill="none" stroke={c.line} stroke-width="1.6" stroke-linecap="round" opacity="0.6"></path>
  <path d="M142 128 C170 116 186 130 182 146 C170 140 158 146 144 152 Z" fill="#ffffff" stroke={c.line} stroke-width="3" stroke-linejoin="round"></path>
  <path d="M174 138 q-8 -2 -14 2 M170 146 q-6 -1 -10 2" fill="none" stroke={c.line} stroke-width="1.6" stroke-linecap="round" opacity="0.6"></path>
{:else}
  <ellipse cx="56" cy="148" rx="8.5" ry="12" fill={c.body} stroke={c.line} stroke-width="3" transform="rotate(-30 56 148)"></ellipse>
  <ellipse cx="144" cy="150" rx="8.5" ry="12" fill={c.body} stroke={c.line} stroke-width="3" transform="rotate(40 144 150)"></ellipse>
{/if}
<ellipse cx="86" cy="136" rx="6.5" ry="8" fill={INK}></ellipse>
<ellipse cx="114" cy="136" rx="6.5" ry="8" fill={INK}></ellipse>
<circle cx="88.5" cy="132.5" r="2.5" fill="#ffffff"></circle>
<circle cx="116.5" cy="132.5" r="2.5" fill="#ffffff"></circle>
<ellipse cx="75" cy="148" rx="7" ry="4" fill="#f3a0c0" opacity="0.7"></ellipse>
<ellipse cx="125" cy="148" rx="7" ry="4" fill="#f3a0c0" opacity="0.7"></ellipse>
{#if role === 'kiek'}
  <path d="M93 150 L107 150 L100 160 Z" fill="#f29d38" stroke="#a85a10" stroke-width="1.8" stroke-linejoin="round"></path>
{:else}
  <path d="M93 152 Q100 159 107 152" fill="none" stroke={INK} stroke-width="2.6" stroke-linecap="round"></path>
{/if}
{#if role === 'funzel'}
  <path d="M150 128 q9 -12 18 0" fill="none" stroke="#5a3410" stroke-width="3" stroke-linecap="round"></path>
  <rect x="146" y="128" width="26" height="32" rx="7" fill="#fff1c2" stroke="#8a4b12" stroke-width="3"></rect>
  <ellipse class="lt-lantern-glow" cx="159" cy="144" rx="16" ry="18" fill="#ffd66b" opacity="0.5"></ellipse>
  <path d="M159 134 C164 141 165 146 159 152 C153 146 154 141 159 134 Z" fill="#ff9f1c" stroke="#b8600a" stroke-width="1.5"></path>
  <rect x="144" y="124" width="30" height="7" rx="3.5" fill="#8a4b12"></rect>
  <path d="M78 62 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#ffffff"></path>
{:else if role === 'lotti'}
  <path d="M68 62 Q100 26 132 62 Z" fill="#2b3f6b" stroke="#16233f" stroke-width="3" stroke-linejoin="round"></path>
  <rect x="70" y="54" width="60" height="9" fill="#ffffff" stroke="#16233f" stroke-width="2"></rect>
  <ellipse cx="100" cy="66" rx="36" ry="7" fill="#1f2f52" stroke="#16233f" stroke-width="2.5"></ellipse>
  <circle cx="100" cy="46" r="5" fill="#f2c84b" stroke="#8a6a10" stroke-width="1.5"></circle>
{:else if role === 'sacki'}
  <path d="M60 76 Q100 34 140 76 Q154 82 158 92 Q100 76 42 92 Q46 82 60 76 Z" fill="#ffcf3f" stroke="#8a6a10" stroke-width="3" stroke-linejoin="round"></path>
  <path d="M74 70 Q100 50 126 70" fill="none" stroke="#fff3b0" stroke-width="3" stroke-linecap="round"></path>
  <path d="M24 186 C16 166 26 150 42 148 L50 142 L56 150 C70 154 74 172 66 186 Z" fill="#d9b26a" stroke="#7a5a22" stroke-width="3" stroke-linejoin="round"></path>
  <path d="M46 146 l8 6 M34 168 q12 4 24 0" fill="none" stroke="#7a5a22" stroke-width="2" stroke-linecap="round"></path>
{:else if role === 'piepser'}
  <path d="M60 124 Q100 66 140 124" fill="none" stroke="#2f3a45" stroke-width="4.5" stroke-linecap="round"></path>
  <circle cx="60" cy="128" r="9" fill="#2f3a45"></circle>
  <circle cx="140" cy="128" r="9" fill="#2f3a45"></circle>
  <path d="M140 134 Q138 152 116 156" fill="none" stroke="#2f3a45" stroke-width="3" stroke-linecap="round"></path>
  <circle cx="114" cy="156" r="3.5" fill="#2f3a45"></circle>
{/if}

<style>
  .lt-lantern-glow {
    animation: lt-lantern 2.2s steps(1) infinite;
  }
  @keyframes lt-lantern {
    0%, 100% { opacity: 0.55; }
    18% { opacity: 0.2; }
    22% { opacity: 0.6; }
    60% { opacity: 0.35; }
    64% { opacity: 0.6; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lt-lantern-glow { animation: none; }
  }
</style>
