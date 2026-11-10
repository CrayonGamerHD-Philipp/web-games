<svelte:options namespace="svg" />

<script>
  /**
   * Die Moosgeister-Figuren (200 × 280) und die Moos-Rückseite.
   * Übernommen aus dem Design-Canvas „Moosgeister – neue Kartengrafiken“.
   */
  /** @type {string} */
  export let name = 'moosling';
</script>

{#if name === 'tauling'}
<ellipse cx="100" cy="194" rx="62" ry="13" fill="#5da653" stroke="#2a6334" stroke-width="3"></ellipse>
<path d="M100 194 L128 183 L124 194 Z" fill="#e3eefa"></path>
<path d="M58 192 Q100 200 142 192" fill="none" stroke="#7fc06d" stroke-width="2.5" stroke-linecap="round"></path>
<ellipse cx="60" cy="154" rx="8.5" ry="12" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(-30 60 154)"></ellipse>
<path d="M100 66 C118 96 146 118 146 148 C146 174 126 190 100 190 C74 190 54 174 54 148 C54 118 82 96 100 66 Z" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M100 88 C114 108 134 126 134 150 C134 168 120 180 100 180 C80 180 66 168 66 150 C66 126 86 108 100 88 Z" fill="#8cc2f2" opacity="0.55"></path>
<path d="M70 132 C72 118 80 106 88 98" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.6"></path>
<circle cx="72" cy="148" r="3.5" fill="#ffffff" opacity="0.55"></circle>
<path d="M100 68 C99 56 103 46 111 42 C119 38 125 44 121 50 C118 55 111 52 113 48" fill="none" stroke="#3d8a3a" stroke-width="3" stroke-linecap="round"></path>
<path d="M102 58 q-8 -2 -10 -8 q7 -1 10 5 M106 50 q-6 -5 -6 -11 q7 2 8 8" fill="#7cc24f" stroke="#3d8a3a" stroke-width="1.6" stroke-linejoin="round"></path>
<ellipse cx="88" cy="146" rx="6.5" ry="8" fill="#13233d"></ellipse>
<ellipse cx="112" cy="146" rx="6.5" ry="8" fill="#13233d"></ellipse>
<circle cx="90.5" cy="142.5" r="2.5" fill="#ffffff"></circle>
<circle cx="114.5" cy="142.5" r="2.5" fill="#ffffff"></circle>
<circle cx="86.4" cy="149.4" r="1.2" fill="#ffffff"></circle>
<circle cx="110.4" cy="149.4" r="1.2" fill="#ffffff"></circle>
<ellipse cx="77" cy="157" rx="7" ry="4" fill="#f3a0c0" opacity="0.65"></ellipse>
<ellipse cx="123" cy="157" rx="7" ry="4" fill="#f3a0c0" opacity="0.65"></ellipse>
<ellipse cx="100" cy="161" rx="4.5" ry="5" fill="#13233d"></ellipse>
<ellipse cx="100" cy="163" rx="2.6" ry="2.2" fill="#e8728f"></ellipse>
<path d="M150 150 C155 158 160 162 160 168 A10 10 0 0 1 140 168 C140 162 145 158 150 150 Z" fill="#cfe7ff" stroke="#1f4f8c" stroke-width="2.5" stroke-linejoin="round"></path>
<path d="M145 166 q1 -4 4 -6" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"></path>
<ellipse cx="140" cy="156" rx="8.5" ry="12" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(40 140 156)"></ellipse>
<path d="M44 80 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z M154 96 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#ffffff"></path>
{:else if name === 'schirm'}
<ellipse cx="100" cy="194" rx="50" ry="9" fill="#9cc8ef" stroke="#1f4f8c" stroke-width="2.5"></ellipse>
<path d="M58 96 c2 4 4 6 4 8 a4 4 0 0 1 -8 0 c0 -2 2 -4 4 -8 Z M44 140 c2 4 4 6 4 8 a4 4 0 0 1 -8 0 c0 -2 2 -4 4 -8 Z M162 120 c2 4 4 6 4 8 a4 4 0 0 1 -8 0 c0 -2 2 -4 4 -8 Z M170 164 c2 4 4 6 4 8 a4 4 0 0 1 -8 0 c0 -2 2 -4 4 -8 Z" fill="#a9d2f5" stroke="#1f4f8c" stroke-width="1.5"></path>
<path d="M130 152 L130 70" stroke="#6b4a2e" stroke-width="3.5" stroke-linecap="round"></path>
<path d="M82 80 Q130 36 178 80 Q166 72 154 82 Q142 72 130 82 Q118 72 106 82 Q94 72 82 80 Z" fill="#6cb552" stroke="#2a6334" stroke-width="3" stroke-linejoin="round"></path>
<path d="M130 46 L130 80 M106 64 L118 80 M154 64 L142 80" stroke="#2a6334" stroke-width="1.8" stroke-linecap="round"></path>
<ellipse cx="66" cy="160" rx="8" ry="11" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(-25 66 160)"></ellipse>
<path d="M100 98 C114 120 136 136 136 158 C136 178 120 190 100 190 C80 190 64 178 64 158 C64 136 86 120 100 98 Z" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M76 144 C78 132 84 124 90 118" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.6"></path>
<path d="M82 156 q6 6 12 0 M106 156 q6 6 12 0" fill="none" stroke="#13233d" stroke-width="3" stroke-linecap="round"></path>
<ellipse cx="80" cy="168" rx="6.5" ry="3.8" fill="#f3a0c0" opacity="0.7"></ellipse>
<ellipse cx="120" cy="168" rx="6.5" ry="3.8" fill="#f3a0c0" opacity="0.7"></ellipse>
<path d="M95 172 Q100 177 105 172" fill="none" stroke="#13233d" stroke-width="2.4" stroke-linecap="round"></path>
<ellipse cx="131" cy="154" rx="8" ry="11" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(20 131 154)"></ellipse>
<path d="M146 186 q4 -6 8 0" fill="none" stroke="#1f4f8c" stroke-width="1.8" stroke-linecap="round"></path>
{:else if name === 'huepf'}
<ellipse cx="100" cy="198" rx="56" ry="9" fill="#9cc8ef" stroke="#1f4f8c" stroke-width="2.5"></ellipse>
<path d="M56 188 c2 -8 6 -12 6 -16 M144 188 c-2 -8 -6 -12 -6 -16 M78 192 c0 -6 2 -9 2 -12 M122 192 c0 -6 -2 -9 -2 -12" fill="none" stroke="#5b9fe0" stroke-width="3" stroke-linecap="round"></path>
<circle cx="46" cy="172" r="4" fill="#a9d2f5" stroke="#1f4f8c" stroke-width="1.5"></circle>
<circle cx="154" cy="170" r="4.5" fill="#a9d2f5" stroke="#1f4f8c" stroke-width="1.5"></circle>
<circle cx="62" cy="160" r="3" fill="#a9d2f5" stroke="#1f4f8c" stroke-width="1.5"></circle>
<path d="M64 186 Q100 180 136 186" fill="none" stroke="#1f4f8c" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round" opacity="0.5"></path>
<ellipse cx="60" cy="108" rx="8" ry="12" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(-150 60 108)"></ellipse>
<ellipse cx="140" cy="108" rx="8" ry="12" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3" transform="rotate(150 140 108)"></ellipse>
<path d="M100 60 C118 88 142 108 142 136 C142 160 124 174 100 174 C76 174 58 160 58 136 C58 108 82 88 100 60 Z" fill="#5b9fe0" stroke="#1f4f8c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M100 80 C114 100 132 116 132 138 C132 154 118 166 100 166 C82 166 68 154 68 138 C68 116 86 100 100 80 Z" fill="#8cc2f2" opacity="0.5"></path>
<path d="M70 124 C72 110 80 98 88 90" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.6"></path>
<ellipse cx="88" cy="132" rx="7" ry="8.5" fill="#13233d"></ellipse>
<ellipse cx="112" cy="132" rx="7" ry="8.5" fill="#13233d"></ellipse>
<circle cx="90.8" cy="128.2" r="2.7" fill="#ffffff"></circle>
<circle cx="114.8" cy="128.2" r="2.7" fill="#ffffff"></circle>
<circle cx="86.2" cy="135.6" r="1.3" fill="#ffffff"></circle>
<circle cx="110.2" cy="135.6" r="1.3" fill="#ffffff"></circle>
<ellipse cx="76" cy="144" rx="7" ry="4" fill="#f3a0c0" opacity="0.7"></ellipse>
<ellipse cx="124" cy="144" rx="7" ry="4" fill="#f3a0c0" opacity="0.7"></ellipse>
<path d="M90 146 Q100 160 110 146 Z" fill="#7a2f3f" stroke="#13233d" stroke-width="2.4" stroke-linejoin="round"></path>
<path d="M95 152 q5 4 10 0" fill="#e8728f"></path>
<path d="M100 62 C98 52 100 44 106 40" fill="none" stroke="#3d8a3a" stroke-width="3" stroke-linecap="round"></path>
<path d="M104 46 q8 -6 14 -2 q-6 7 -14 2 Z" fill="#7cc24f" stroke="#3d8a3a" stroke-width="1.6" stroke-linejoin="round"></path>
{:else if name === 'moosling'}
<ellipse cx="100" cy="199" rx="58" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<ellipse cx="84" cy="194" rx="12" ry="6.5" fill="#3f7a30" stroke="#24461a" stroke-width="3"></ellipse>
<ellipse cx="116" cy="194" rx="12" ry="6.5" fill="#3f7a30" stroke="#24461a" stroke-width="3"></ellipse>
<path d="M86 98 C68 82 70 64 84 54 C94 68 96 84 86 98 Z" fill="#8ccf5f" stroke="#2a6334" stroke-width="3" stroke-linejoin="round"></path>
<path d="M85 94 C81 80 82 68 84 58" fill="none" stroke="#2a6334" stroke-width="1.8" stroke-linecap="round"></path>
<path d="M114 98 C132 82 130 64 116 54 C106 68 104 84 114 98 Z" fill="#8ccf5f" stroke="#2a6334" stroke-width="3" stroke-linejoin="round"></path>
<path d="M115 94 C119 80 118 68 116 58" fill="none" stroke="#2a6334" stroke-width="1.8" stroke-linecap="round"></path>
<g fill="#5c9a45" stroke="#2a6334" stroke-width="3">
<circle cx="150" cy="144" r="8"></circle><circle cx="143" cy="169" r="8"></circle><circle cx="125" cy="187" r="8"></circle>
<circle cx="100" cy="194" r="8"></circle><circle cx="75" cy="187" r="8"></circle><circle cx="57" cy="169" r="8"></circle>
<circle cx="50" cy="144" r="8"></circle><circle cx="57" cy="119" r="8"></circle><circle cx="75" cy="101" r="8"></circle>
<circle cx="100" cy="94" r="8"></circle><circle cx="125" cy="101" r="8"></circle><circle cx="143" cy="119" r="8"></circle>
</g>
<circle cx="100" cy="144" r="50" fill="#5c9a45"></circle>
<g fill="#7dbb5c">
<circle cx="72" cy="122" r="6"></circle><circle cx="84" cy="112" r="4"></circle><circle cx="128" cy="118" r="5"></circle>
<circle cx="138" cy="150" r="4"></circle><circle cx="66" cy="152" r="4.5"></circle><circle cx="118" cy="180" r="5"></circle><circle cx="80" cy="182" r="4"></circle>
</g>
<g fill="#3f7a30">
<circle cx="64" cy="134" r="2.4"></circle><circle cx="136" cy="132" r="2.4"></circle><circle cx="92" cy="186" r="2.2"></circle>
<circle cx="132" cy="168" r="2.2"></circle><circle cx="70" cy="170" r="2.2"></circle><circle cx="112" cy="110" r="2.2"></circle>
</g>
<ellipse cx="100" cy="152" rx="30" ry="22" fill="#6fae52" opacity="0.6"></ellipse>
<ellipse cx="88" cy="146" rx="7" ry="8.5" fill="#1f2a17"></ellipse>
<ellipse cx="112" cy="146" rx="7" ry="8.5" fill="#1f2a17"></ellipse>
<circle cx="90.8" cy="142.2" r="2.7" fill="#ffffff"></circle>
<circle cx="114.8" cy="142.2" r="2.7" fill="#ffffff"></circle>
<circle cx="86.2" cy="149.6" r="1.3" fill="#ffffff"></circle>
<circle cx="110.2" cy="149.6" r="1.3" fill="#ffffff"></circle>
<ellipse cx="77" cy="158" rx="7" ry="4" fill="#f4a08a" opacity="0.7"></ellipse>
<ellipse cx="123" cy="158" rx="7" ry="4" fill="#f4a08a" opacity="0.7"></ellipse>
<path d="M92 159 Q100 168 108 159" fill="none" stroke="#1f2a17" stroke-width="2.8" stroke-linecap="round"></path>
<rect x="141" y="104" width="6" height="12" rx="3" fill="#f6ead6" stroke="#6b4a2e" stroke-width="2"></rect>
<path d="M134 106 Q144 92 154 106 Z" fill="#c9784a" stroke="#6b4a2e" stroke-width="2" stroke-linejoin="round"></path>
<circle cx="141" cy="101" r="1.6" fill="#f6ead6"></circle>
<path d="M132 200 q0 -10 -6 -14 M132 200 q2 -9 9 -12 M132 200 q-1 -8 4 -16" fill="none" stroke="#3d8a3a" stroke-width="2.2" stroke-linecap="round"></path>
<circle cx="126" cy="186" r="3.5" fill="#7cc24f"></circle><circle cx="141" cy="188" r="3.5" fill="#7cc24f"></circle><circle cx="136" cy="184" r="3.5" fill="#8ad35a"></circle>
{:else if name === 'farn'}
<ellipse cx="100" cy="198" rx="50" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M100 88 C96 68 86 56 72 52 C64 50 60 58 66 62 C70 65 76 62 74 58" fill="none" stroke="#3d8a3a" stroke-width="3" stroke-linecap="round"></path>
<path d="M100 88 C100 64 104 48 114 40 C120 36 126 42 122 47 C119 51 113 48 115 45" fill="none" stroke="#3d8a3a" stroke-width="3" stroke-linecap="round"></path>
<path d="M100 88 C108 70 122 62 136 62 C144 62 146 70 140 72 C135 74 132 68 136 66" fill="none" stroke="#3d8a3a" stroke-width="3" stroke-linecap="round"></path>
<g fill="#7cc24f" stroke="#3d8a3a" stroke-width="1.5" stroke-linejoin="round">
<path d="M92 74 q-10 2 -14 -4 q9 -3 14 4 Z"></path><path d="M86 64 q-8 -2 -10 -9 q8 1 10 9 Z"></path>
<path d="M102 70 q-8 -4 -8 -11 q8 2 8 11 Z"></path><path d="M104 58 q-6 -5 -5 -12 q7 3 5 12 Z"></path>
<path d="M112 76 q4 -9 12 -10 q-2 8 -12 10 Z"></path><path d="M122 68 q4 -8 11 -8 q-2 7 -11 8 Z"></path>
</g>
<ellipse cx="66" cy="158" rx="8" ry="12" fill="#6cb552" stroke="#2a6334" stroke-width="3" transform="rotate(-30 66 158)"></ellipse>
<path d="M100 86 C126 86 134 112 134 142 C134 172 120 192 100 192 C80 192 66 172 66 142 C66 112 74 86 100 86 Z" fill="#6cb552" stroke="#2a6334" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M78 120 C80 106 86 98 94 94" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.35"></path>
<ellipse cx="100" cy="168" rx="20" ry="16" fill="#8ccf5f" opacity="0.55"></ellipse>
<ellipse cx="88" cy="138" rx="6.5" ry="8" fill="#1f2a17"></ellipse>
<circle cx="90.5" cy="134.5" r="2.5" fill="#ffffff"></circle>
<circle cx="86.4" cy="141.4" r="1.2" fill="#ffffff"></circle>
<path d="M105 139 q7 -6 14 0" fill="none" stroke="#1f2a17" stroke-width="3" stroke-linecap="round"></path>
<ellipse cx="78" cy="151" rx="7" ry="4" fill="#f4a08a" opacity="0.7"></ellipse>
<ellipse cx="122" cy="151" rx="7" ry="4" fill="#f4a08a" opacity="0.7"></ellipse>
<path d="M92 152 Q100 160 108 152" fill="none" stroke="#1f2a17" stroke-width="2.6" stroke-linecap="round"></path>
<path d="M104 156 q3 6 7 2" fill="#e8728f" stroke="#1f2a17" stroke-width="1.6" stroke-linejoin="round"></path>
<path d="M140 132 C148 122 156 120 162 122 C160 132 150 138 140 136 Z" fill="#a9d36f" stroke="#2a6334" stroke-width="2" stroke-linejoin="round"></path>
<ellipse cx="134" cy="150" rx="8" ry="12" fill="#6cb552" stroke="#2a6334" stroke-width="3" transform="rotate(30 134 150)"></ellipse>
<ellipse cx="88" cy="194" rx="11" ry="5" fill="#4f9a3f" stroke="#2a6334" stroke-width="2.5"></ellipse>
<ellipse cx="112" cy="194" rx="11" ry="5" fill="#4f9a3f" stroke="#2a6334" stroke-width="2.5"></ellipse>
{:else if name === 'schnecke'}
<ellipse cx="100" cy="198" rx="64" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M36 190 C34 172 52 166 70 170 L150 178 C164 180 166 192 152 194 L46 196 C40 196 36 194 36 190 Z" fill="#d6e8a8" stroke="#2a6334" stroke-width="3" stroke-linejoin="round"></path>
<path d="M60 142 L50 118 M72 140 L76 116" stroke="#2a6334" stroke-width="3" stroke-linecap="round"></path>
<circle cx="50" cy="116" r="7" fill="#d6e8a8" stroke="#2a6334" stroke-width="2.5"></circle>
<circle cx="76" cy="114" r="7" fill="#d6e8a8" stroke="#2a6334" stroke-width="2.5"></circle>
<circle cx="51" cy="116" r="3.8" fill="#1f2a17"></circle>
<circle cx="77" cy="114" r="3.8" fill="#1f2a17"></circle>
<circle cx="52.4" cy="114.6" r="1.4" fill="#ffffff"></circle>
<circle cx="78.4" cy="112.6" r="1.4" fill="#ffffff"></circle>
<path d="M42 182 C38 160 50 140 66 140 C80 140 88 152 88 166 L88 178 Z" fill="#d6e8a8" stroke="#2a6334" stroke-width="3" stroke-linejoin="round"></path>
<ellipse cx="54" cy="164" rx="6" ry="3.6" fill="#f4a08a" opacity="0.75"></ellipse>
<path d="M60 164 Q66 170 72 164" fill="none" stroke="#1f2a17" stroke-width="2.4" stroke-linecap="round"></path>
<g fill="#5c9a45" stroke="#2a6334" stroke-width="3">
<circle cx="154" cy="140" r="8"></circle><circle cx="148" cy="164" r="8"></circle><circle cx="128" cy="180" r="8"></circle><circle cx="104" cy="182" r="8"></circle>
<circle cx="80" cy="168" r="8"></circle><circle cx="74" cy="142" r="8"></circle><circle cx="84" cy="116" r="8"></circle><circle cx="108" cy="100" r="8"></circle>
<circle cx="134" cy="102" r="8"></circle><circle cx="150" cy="118" r="8"></circle>
</g>
<circle cx="114" cy="140" r="42" fill="#5c9a45"></circle>
<path d="M114 140 a6 6 0 0 1 12 0 a12 12 0 0 1 -24 0 a18 18 0 0 1 36 0 a24 24 0 0 1 -48 0" fill="none" stroke="#2f5f24" stroke-width="3.2" stroke-linecap="round"></path>
<g fill="#7dbb5c"><circle cx="96" cy="118" r="4.5"></circle><circle cx="138" cy="160" r="4"></circle><circle cx="128" cy="112" r="3.5"></circle></g>
<path d="M120 98 C120 88 124 82 130 80" fill="none" stroke="#3d8a3a" stroke-width="2.6" stroke-linecap="round"></path>
<path d="M124 86 q-9 -2 -11 -9 q8 0 11 9 Z M128 82 q5 -8 12 -7 q-3 7 -12 7 Z" fill="#8ad35a" stroke="#3d8a3a" stroke-width="1.5" stroke-linejoin="round"></path>
{:else if name === 'pfifferling'}
<ellipse cx="100" cy="198" rx="58" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M50 196 q6 -12 12 0 q6 -10 12 0 M128 196 q6 -12 12 0 q6 -10 12 0" fill="#6fae43" stroke="#3d6b22" stroke-width="2" stroke-linejoin="round"></path>
<ellipse cx="67" cy="158" rx="8.5" ry="12" fill="#f8d977" stroke="#9b6f0c" stroke-width="3" transform="rotate(-30 67 158)"></ellipse>
<path d="M76 118 C72 152 72 190 100 192 C128 190 128 152 124 118 Z" fill="#f8d977" stroke="#9b6f0c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M84 140 C84 160 86 178 92 186 M116 140 C116 160 114 178 108 186" fill="none" stroke="#e6b94a" stroke-width="2" stroke-linecap="round"></path>
<ellipse cx="88" cy="194" rx="11" ry="5.5" fill="#f2c95a" stroke="#9b6f0c" stroke-width="3"></ellipse>
<ellipse cx="112" cy="194" rx="11" ry="5.5" fill="#f2c95a" stroke="#9b6f0c" stroke-width="3"></ellipse>
<ellipse cx="145" cy="170" rx="11" ry="13" fill="#c98b4a" stroke="#6b4319" stroke-width="2.5"></ellipse>
<path d="M132 162 Q145 148 158 162 Q145 168 132 162 Z" fill="#8a5a2b" stroke="#6b4319" stroke-width="2.5" stroke-linejoin="round"></path>
<path d="M145 151 l2 -6" stroke="#6b4319" stroke-width="2.5" stroke-linecap="round"></path>
<path d="M139 172 q4 4 9 0" fill="none" stroke="#e7b37a" stroke-width="1.8" stroke-linecap="round"></path>
<ellipse cx="133" cy="160" rx="8.5" ry="12" fill="#f8d977" stroke="#9b6f0c" stroke-width="3" transform="rotate(35 133 160)"></ellipse>
<ellipse cx="89" cy="160" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<ellipse cx="111" cy="160" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<circle cx="91.5" cy="156.5" r="2.5" fill="#ffffff"></circle>
<circle cx="113.5" cy="156.5" r="2.5" fill="#ffffff"></circle>
<circle cx="87.4" cy="163.4" r="1.2" fill="#ffffff"></circle>
<circle cx="109.4" cy="163.4" r="1.2" fill="#ffffff"></circle>
<ellipse cx="80" cy="171" rx="6.5" ry="3.8" fill="#f08a6a" opacity="0.7"></ellipse>
<ellipse cx="120" cy="171" rx="6.5" ry="3.8" fill="#f08a6a" opacity="0.7"></ellipse>
<path d="M94 171 Q100 179 106 171 Q100 174 94 171 Z" fill="#7a2f1a" stroke="#2b1d16" stroke-width="2" stroke-linejoin="round"></path>
<path d="M34 92 Q46 78 60 88 Q72 76 86 86 Q100 74 114 86 Q128 76 140 88 Q154 78 166 92 C156 110 132 124 100 126 C68 124 44 110 34 92 Z" fill="#f2b530" stroke="#9b6f0c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M48 92 Q100 103 152 92" fill="none" stroke="#f9d469" stroke-width="5" stroke-linecap="round"></path>
<path d="M58 104 L82 120 M76 109 L91 123 M100 111 L100 125 M124 109 L109 123 M142 104 L118 120" stroke="#c98a12" stroke-width="2.2" stroke-linecap="round"></path>
<path d="M64 84 Q72 79 80 82" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.45"></path>
<path d="M150 56 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#ffe28a"></path>
{:else if name === 'eichel'}
<ellipse cx="100" cy="198" rx="50" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<ellipse cx="64" cy="156" rx="8" ry="12" fill="#e6b53a" stroke="#9b6f0c" stroke-width="3" transform="rotate(-30 64 156)"></ellipse>
<ellipse cx="136" cy="156" rx="8" ry="12" fill="#e6b53a" stroke="#9b6f0c" stroke-width="3" transform="rotate(30 136 156)"></ellipse>
<path d="M68 116 C64 156 80 192 100 192 C120 192 136 156 132 116 Z" fill="#efc14a" stroke="#9b6f0c" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M84 128 C82 152 88 172 96 182" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.35"></path>
<ellipse cx="88" cy="146" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<ellipse cx="112" cy="146" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<circle cx="90.5" cy="142.5" r="2.5" fill="#ffffff"></circle>
<circle cx="114.5" cy="142.5" r="2.5" fill="#ffffff"></circle>
<circle cx="86.4" cy="149.4" r="1.2" fill="#ffffff"></circle>
<circle cx="110.4" cy="149.4" r="1.2" fill="#ffffff"></circle>
<ellipse cx="79" cy="158" rx="6.5" ry="3.8" fill="#f08a6a" opacity="0.7"></ellipse>
<ellipse cx="121" cy="158" rx="6.5" ry="3.8" fill="#f08a6a" opacity="0.7"></ellipse>
<path d="M95 160 Q100 166 105 160" fill="none" stroke="#2b1d16" stroke-width="2.5" stroke-linecap="round"></path>
<path d="M58 118 C58 90 76 76 100 76 C124 76 142 90 142 118 C122 128 78 128 58 118 Z" fill="#9a6b33" stroke="#5e3d16" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M68 104 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 M64 116 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 M76 92 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0 q6 -5 12 0" fill="none" stroke="#6e4a20" stroke-width="2" stroke-linecap="round"></path>
<path d="M100 76 C100 66 104 60 112 58" fill="none" stroke="#5e3d16" stroke-width="4" stroke-linecap="round"></path>
<path d="M112 58 C122 50 134 52 140 58 C132 66 120 66 112 58 Z" fill="#7cc24f" stroke="#3d6b22" stroke-width="2" stroke-linejoin="round"></path>
<path d="M114 58 L136 58" stroke="#3d6b22" stroke-width="1.5" stroke-linecap="round"></path>
<ellipse cx="88" cy="194" rx="11" ry="5" fill="#c98b4a" stroke="#6b4319" stroke-width="2.5"></ellipse>
<ellipse cx="112" cy="194" rx="11" ry="5" fill="#c98b4a" stroke="#6b4319" stroke-width="2.5"></ellipse>
{:else if name === 'gluehwurm'}
<circle cx="112" cy="156" r="56" fill="#fff2a0" opacity="0.35"></circle>
<circle cx="112" cy="156" r="42" fill="#fff2a0" opacity="0.45"></circle>
<ellipse cx="96" cy="100" rx="22" ry="30" fill="#ffffff" stroke="#9b6f0c" stroke-width="2" opacity="0.75" transform="rotate(-30 96 100)"></ellipse>
<ellipse cx="128" cy="100" rx="20" ry="28" fill="#ffffff" stroke="#9b6f0c" stroke-width="2" opacity="0.75" transform="rotate(25 128 100)"></ellipse>
<path d="M90 92 q4 10 2 22 M130 94 q-4 10 -1 20" fill="none" stroke="#c9a84a" stroke-width="1.4" stroke-linecap="round" opacity="0.8"></path>
<ellipse cx="114" cy="160" rx="32" ry="30" fill="#ffd84d" stroke="#9b6f0c" stroke-width="3.5"></ellipse>
<path d="M88 152 Q114 146 140 152 M86 166 Q114 160 142 166 M92 180 Q114 175 136 180" fill="none" stroke="#e8b52a" stroke-width="2.4" stroke-linecap="round"></path>
<ellipse cx="104" cy="148" rx="10" ry="6" fill="#ffffff" opacity="0.5"></ellipse>
<path d="M98 186 l-6 10 M112 190 l0 10 M126 186 l6 10" stroke="#4a3d2e" stroke-width="3" stroke-linecap="round"></path>
<circle cx="88" cy="128" r="26" fill="#6a5640" stroke="#3d2f22" stroke-width="3.5"></circle>
<path d="M78 104 C72 92 64 86 56 86 M96 103 C98 90 104 82 112 80" fill="none" stroke="#3d2f22" stroke-width="2.6" stroke-linecap="round"></path>
<circle cx="55" cy="86" r="4.5" fill="#ffd84d" stroke="#9b6f0c" stroke-width="1.8"></circle>
<circle cx="113" cy="79" r="4.5" fill="#ffd84d" stroke="#9b6f0c" stroke-width="1.8"></circle>
<ellipse cx="80" cy="126" rx="6.5" ry="7.5" fill="#ffffff"></ellipse>
<ellipse cx="98" cy="126" rx="6.5" ry="7.5" fill="#ffffff"></ellipse>
<circle cx="81.5" cy="127" r="3.8" fill="#1d150e"></circle>
<circle cx="99.5" cy="127" r="3.8" fill="#1d150e"></circle>
<circle cx="83" cy="125.4" r="1.4" fill="#ffffff"></circle>
<circle cx="101" cy="125.4" r="1.4" fill="#ffffff"></circle>
<ellipse cx="73" cy="138" rx="5" ry="3" fill="#f08a6a" opacity="0.8"></ellipse>
<ellipse cx="104" cy="138" rx="5" ry="3" fill="#f08a6a" opacity="0.8"></ellipse>
<path d="M84 140 Q89 145 94 140" fill="none" stroke="#fbe7c4" stroke-width="2.4" stroke-linecap="round"></path>
<path d="M150 70 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z M44 150 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#ffd84d"></path>
{:else if name === 'fliegenpilz'}
<ellipse cx="100" cy="198" rx="60" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M52 196 q6 -12 12 0 q6 -10 12 0 M124 196 q6 -12 12 0 q6 -10 12 0" fill="#6fae43" stroke="#3d6b22" stroke-width="2" stroke-linejoin="round"></path>
<ellipse cx="63" cy="160" rx="9" ry="13" fill="#f6e6cf" stroke="#8c262f" stroke-width="3" transform="rotate(-28 63 160)"></ellipse>
<ellipse cx="137" cy="160" rx="9" ry="13" fill="#f6e6cf" stroke="#8c262f" stroke-width="3" transform="rotate(28 137 160)"></ellipse>
<path d="M70 116 C66 150 68 190 100 192 C132 190 134 150 130 116 Z" fill="#fbf1e2" stroke="#8c262f" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M73 132 Q100 146 127 132 L125 143 Q100 157 75 143 Z" fill="#f1dcc0" stroke="#8c262f" stroke-width="2.5" stroke-linejoin="round"></path>
<ellipse cx="86" cy="194" rx="12" ry="6" fill="#f1dcc0" stroke="#8c262f" stroke-width="3"></ellipse>
<ellipse cx="114" cy="194" rx="12" ry="6" fill="#f1dcc0" stroke="#8c262f" stroke-width="3"></ellipse>
<ellipse cx="88" cy="164" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<ellipse cx="112" cy="164" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<circle cx="90.5" cy="160.5" r="2.5" fill="#ffffff"></circle>
<circle cx="114.5" cy="160.5" r="2.5" fill="#ffffff"></circle>
<circle cx="86.4" cy="167.4" r="1.2" fill="#ffffff"></circle>
<circle cx="110.4" cy="167.4" r="1.2" fill="#ffffff"></circle>
<ellipse cx="78" cy="175" rx="7" ry="4" fill="#f08a8a" opacity="0.75"></ellipse>
<ellipse cx="122" cy="175" rx="7" ry="4" fill="#f08a8a" opacity="0.75"></ellipse>
<path d="M95 176 Q100 182 105 176" fill="none" stroke="#2b1d16" stroke-width="2.6" stroke-linecap="round"></path>
<path d="M38 115 Q100 131 162 115 Q100 141 38 115 Z" fill="#efd6bb" stroke="#8c262f" stroke-width="3" stroke-linejoin="round"></path>
<path d="M58 119 L62 126 M74 122 L76 130 M90 124 L91 132 M110 124 L109 132 M126 122 L124 130 M142 119 L138 126" stroke="#c9a582" stroke-width="2" stroke-linecap="round"></path>
<path d="M36 115 C36 72 64 50 100 50 C136 50 164 72 164 115 C132 125 68 125 36 115 Z" fill="#d9443e" stroke="#8c262f" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M58 84 C66 69 81 60 97 58" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.35"></path>
<circle cx="70" cy="93" r="9" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="104" cy="71" r="8" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="137" cy="93" r="10" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="96" cy="103" r="5.5" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="55" cy="108" r="4.5" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="122" cy="110" r="4.5" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.5"></circle>
<circle cx="80" cy="66" r="3.5" fill="#fff8ee" stroke="#e7c9b6" stroke-width="1.2"></circle>
<path d="M146 62 q4 -10 12 -8 q-2 9 -12 8 Z" fill="#7cc24f" stroke="#3d6b22" stroke-width="1.8" stroke-linejoin="round"></path>
{:else if name === 'erdbeer'}
<ellipse cx="100" cy="198" rx="48" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<ellipse cx="62" cy="148" rx="8" ry="12" fill="#e0424a" stroke="#8c262f" stroke-width="3" transform="rotate(-35 62 148)"></ellipse>
<path d="M100 192 C70 180 56 150 60 124 C64 100 84 92 100 98 C116 92 136 100 140 124 C144 150 130 180 100 192 Z" fill="#e0424a" stroke="#8c262f" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M72 124 C74 112 82 104 92 102" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.35"></path>
<g fill="#ffe08a" stroke="#c99a2a" stroke-width="0.8">
<ellipse cx="74" cy="142" rx="2" ry="3"></ellipse><ellipse cx="128" cy="140" rx="2" ry="3"></ellipse><ellipse cx="80" cy="166" rx="2" ry="3"></ellipse>
<ellipse cx="120" cy="166" rx="2" ry="3"></ellipse><ellipse cx="100" cy="180" rx="2" ry="3"></ellipse><ellipse cx="90" cy="112" rx="2" ry="3"></ellipse>
<ellipse cx="112" cy="112" rx="2" ry="3"></ellipse><ellipse cx="68" cy="124" rx="2" ry="3"></ellipse><ellipse cx="132" cy="124" rx="2" ry="3"></ellipse>
<ellipse cx="108" cy="172" rx="2" ry="3"></ellipse><ellipse cx="92" cy="172" rx="2" ry="3"></ellipse>
</g>
<path d="M100 100 L86 86 L94 98 L74 94 L92 102 L80 108 L100 104 L120 108 L108 102 L126 94 L106 98 L114 86 Z" fill="#6cb552" stroke="#2a6334" stroke-width="2.5" stroke-linejoin="round"></path>
<path d="M100 98 C100 88 102 80 108 74" fill="none" stroke="#2a6334" stroke-width="3.5" stroke-linecap="round"></path>
<ellipse cx="89" cy="136" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<ellipse cx="111" cy="136" rx="6.5" ry="8" fill="#2b1d16"></ellipse>
<circle cx="91.5" cy="132.5" r="2.5" fill="#ffffff"></circle>
<circle cx="113.5" cy="132.5" r="2.5" fill="#ffffff"></circle>
<circle cx="87.4" cy="139.4" r="1.2" fill="#ffffff"></circle>
<circle cx="109.4" cy="139.4" r="1.2" fill="#ffffff"></circle>
<ellipse cx="79" cy="150" rx="6.5" ry="3.8" fill="#ffb3b8" opacity="0.85"></ellipse>
<ellipse cx="121" cy="150" rx="6.5" ry="3.8" fill="#ffb3b8" opacity="0.85"></ellipse>
<path d="M95 150 Q100 156 105 150" fill="none" stroke="#2b1d16" stroke-width="2.5" stroke-linecap="round"></path>
<ellipse cx="138" cy="148" rx="8" ry="12" fill="#e0424a" stroke="#8c262f" stroke-width="3" transform="rotate(35 138 148)"></ellipse>
<path d="M144 132 q4 -6 8 0 q4 -6 8 0 q-8 8 -8 8 q0 0 -8 -8 Z" fill="#ffb3b8" stroke="#8c262f" stroke-width="1.5" stroke-linejoin="round"></path>
{:else if name === 'kaefer'}
<ellipse cx="100" cy="198" rx="54" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M62 186 l-8 8 M80 194 l-4 6 M120 194 l4 6 M138 186 l8 8" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round"></path>
<path d="M58 124 C40 112 34 98 38 88" fill="none" stroke="#2b2b2b" stroke-width="5" stroke-linecap="round"></path>
<circle cx="38" cy="86" r="7" fill="#2b2b2b"></circle>
<circle cx="100" cy="152" r="46" fill="#d9443e" stroke="#8c262f" stroke-width="3.5"></circle>
<path d="M100 112 L100 198" stroke="#2b2b2b" stroke-width="3"></path>
<g fill="#2b2b2b">
<circle cx="76" cy="138" r="8"></circle><circle cx="124" cy="138" r="8"></circle><circle cx="72" cy="168" r="7"></circle>
<circle cx="128" cy="168" r="7"></circle><circle cx="90" cy="184" r="5"></circle><circle cx="110" cy="184" r="5"></circle>
</g>
<path d="M68 128 C72 120 78 116 84 114" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.35"></path>
<path d="M88 92 C84 80 78 72 70 70 M112 92 C116 80 122 72 130 70" fill="none" stroke="#2b2b2b" stroke-width="2.8" stroke-linecap="round"></path>
<circle cx="69" cy="70" r="4.5" fill="#2b2b2b"></circle>
<circle cx="131" cy="70" r="4.5" fill="#2b2b2b"></circle>
<circle cx="100" cy="112" r="26" fill="#3a3a3a" stroke="#1d1d1d" stroke-width="3"></circle>
<ellipse cx="90" cy="110" rx="7" ry="8" fill="#ffffff"></ellipse>
<ellipse cx="110" cy="110" rx="7" ry="8" fill="#ffffff"></ellipse>
<circle cx="91.5" cy="111" r="4" fill="#1d150e"></circle>
<circle cx="111.5" cy="111" r="4" fill="#1d150e"></circle>
<circle cx="93" cy="109.2" r="1.5" fill="#ffffff"></circle>
<circle cx="113" cy="109.2" r="1.5" fill="#ffffff"></circle>
<ellipse cx="82" cy="122" rx="5" ry="3" fill="#f08a8a" opacity="0.85"></ellipse>
<ellipse cx="118" cy="122" rx="5" ry="3" fill="#f08a8a" opacity="0.85"></ellipse>
<path d="M95 123 Q100 128 105 123" fill="none" stroke="#f6e6cf" stroke-width="2.4" stroke-linecap="round"></path>
{:else if name === 'bluete'}
<ellipse cx="100" cy="198" rx="54" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M100 160 L100 196" stroke="#3d8a3a" stroke-width="7" stroke-linecap="round"></path>
<path d="M100 182 C86 178 76 170 70 160 C84 159 95 166 100 176 Z" fill="#6cb552" stroke="#2a6334" stroke-width="2.5" stroke-linejoin="round"></path>
<path d="M100 176 C114 172 124 164 130 154 C116 153 105 160 100 170 Z" fill="#6cb552" stroke="#2a6334" stroke-width="2.5" stroke-linejoin="round"></path>
<g stroke="#5b4a3a" stroke-width="2.5">
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#5b9fe0" transform="translate(100 90) rotate(0)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#6cb552" transform="translate(122.3 97.3) rotate(36)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#f2b530" transform="translate(136.1 116.3) rotate(72)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#d9443e" transform="translate(136.1 139.7) rotate(108)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#5b9fe0" transform="translate(122.3 158.7) rotate(144)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#6cb552" transform="translate(100 166) rotate(180)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#f2b530" transform="translate(77.7 158.7) rotate(216)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#d9443e" transform="translate(63.9 139.7) rotate(252)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#5b9fe0" transform="translate(63.9 116.3) rotate(288)"></ellipse>
<ellipse cx="0" cy="0" rx="14" ry="24" fill="#f2b530" transform="translate(77.7 97.3) rotate(324)"></ellipse>
</g>
<g fill="#ffffff" opacity="0.35">
<ellipse cx="0" cy="-8" rx="4" ry="9" transform="translate(100 90)"></ellipse>
<ellipse cx="0" cy="-8" rx="4" ry="9" transform="translate(122.3 97.3) rotate(36)"></ellipse>
<ellipse cx="0" cy="-8" rx="4" ry="9" transform="translate(77.7 97.3) rotate(324)"></ellipse>
</g>
<circle cx="100" cy="128" r="30" fill="#fde9c9" stroke="#5b4a3a" stroke-width="3"></circle>
<ellipse cx="89" cy="124" rx="6" ry="7.5" fill="#2b1d16"></ellipse>
<ellipse cx="111" cy="124" rx="6" ry="7.5" fill="#2b1d16"></ellipse>
<circle cx="91.3" cy="120.6" r="2.3" fill="#ffffff"></circle>
<circle cx="113.3" cy="120.6" r="2.3" fill="#ffffff"></circle>
<circle cx="87.4" cy="127.2" r="1.1" fill="#ffffff"></circle>
<circle cx="109.4" cy="127.2" r="1.1" fill="#ffffff"></circle>
<ellipse cx="80" cy="134" rx="6" ry="3.6" fill="#f08a8a" opacity="0.75"></ellipse>
<ellipse cx="120" cy="134" rx="6" ry="3.6" fill="#f08a8a" opacity="0.75"></ellipse>
<path d="M94 135 Q100 142 106 135" fill="none" stroke="#2b1d16" stroke-width="2.5" stroke-linecap="round"></path>
<path d="M146 66 q4 -6 8 0 q4 -6 8 0 q-8 8 -8 8 q0 0 -8 -8 Z" fill="#f08a8a" stroke="#8c262f" stroke-width="1.5" stroke-linejoin="round"></path>
{:else if name === 'raupe'}
<ellipse cx="100" cy="198" rx="66" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M30 196 C50 186 74 188 100 194 C126 198 150 192 172 196" fill="none" stroke="#6cb552" stroke-width="6" stroke-linecap="round"></path>
<g stroke="#5b4a3a" stroke-width="3">
<circle cx="44" cy="174" r="18" fill="#6cb552"></circle>
<circle cx="72" cy="166" r="20" fill="#f2b530"></circle>
<circle cx="100" cy="162" r="21" fill="#d9443e"></circle>
<circle cx="128" cy="160" r="22" fill="#5b9fe0"></circle>
</g>
<g fill="#ffffff" opacity="0.35"><circle cx="38" cy="166" r="5"></circle><circle cx="66" cy="157" r="5"></circle><circle cx="94" cy="152" r="5.5"></circle><circle cx="121" cy="150" r="5.5"></circle></g>
<g fill="#5b4a3a"><circle cx="40" cy="194" r="3.5"></circle><circle cx="68" cy="188" r="3.5"></circle><circle cx="96" cy="185" r="3.5"></circle><circle cx="124" cy="184" r="3.5"></circle></g>
<path d="M150 116 C146 102 140 94 132 92 M166 116 C170 102 176 94 184 92" fill="none" stroke="#5b4a3a" stroke-width="2.8" stroke-linecap="round"></path>
<circle cx="131" cy="91" r="5" fill="#f2b530" stroke="#5b4a3a" stroke-width="2"></circle>
<circle cx="185" cy="91" r="5" fill="#d9443e" stroke="#5b4a3a" stroke-width="2"></circle>
<circle cx="158" cy="138" r="27" fill="#fde9c9" stroke="#5b4a3a" stroke-width="3"></circle>
<ellipse cx="148" cy="134" rx="6" ry="7.5" fill="#2b1d16"></ellipse>
<ellipse cx="168" cy="134" rx="6" ry="7.5" fill="#2b1d16"></ellipse>
<circle cx="150.3" cy="130.6" r="2.3" fill="#ffffff"></circle>
<circle cx="170.3" cy="130.6" r="2.3" fill="#ffffff"></circle>
<circle cx="146.4" cy="137.2" r="1.1" fill="#ffffff"></circle>
<circle cx="166.4" cy="137.2" r="1.1" fill="#ffffff"></circle>
<ellipse cx="140" cy="146" rx="5.5" ry="3.4" fill="#f08a8a" opacity="0.8"></ellipse>
<ellipse cx="176" cy="146" rx="5.5" ry="3.4" fill="#f08a8a" opacity="0.8"></ellipse>
<path d="M152 147 Q158 154 164 147" fill="none" stroke="#2b1d16" stroke-width="2.5" stroke-linecap="round"></path>
<path d="M142 114 C150 104 166 104 174 114 C162 118 154 118 142 114 Z" fill="#6cb552" stroke="#2a6334" stroke-width="2" stroke-linejoin="round"></path>
{:else if name === 'falter'}
<ellipse cx="100" cy="198" rx="48" ry="8" fill="#2f4a1d" opacity="0.18"></ellipse>
<path d="M100 196 L100 174" stroke="#3d8a3a" stroke-width="5" stroke-linecap="round"></path>
<path d="M100 186 C90 184 84 178 82 172 C92 172 98 176 100 182 Z M100 182 C110 180 116 174 118 168 C108 168 102 172 100 178 Z" fill="#6cb552" stroke="#2a6334" stroke-width="2" stroke-linejoin="round"></path>
<g stroke="#5b4a3a" stroke-width="3" stroke-linejoin="round">
<path d="M98 118 C80 86 44 78 34 98 C26 116 52 138 96 132 Z" fill="#5b9fe0"></path>
<path d="M102 118 C120 86 156 78 166 98 C174 116 148 138 104 132 Z" fill="#6cb552"></path>
<path d="M96 138 C66 138 46 152 52 168 C58 182 82 176 98 150 Z" fill="#f2b530"></path>
<path d="M104 138 C134 138 154 152 148 168 C142 182 118 176 102 150 Z" fill="#d9443e"></path>
</g>
<g fill="#ffffff" opacity="0.85">
<circle cx="56" cy="102" r="7"></circle><circle cx="74" cy="114" r="4"></circle><circle cx="144" cy="102" r="7"></circle><circle cx="126" cy="114" r="4"></circle>
<circle cx="68" cy="160" r="5"></circle><circle cx="132" cy="160" r="5"></circle>
</g>
<rect x="92" y="104" width="16" height="64" rx="8" fill="#5b4a3a"></rect>
<path d="M94 124 h12 M94 136 h12 M94 148 h12" stroke="#7a6a58" stroke-width="2" stroke-linecap="round"></path>
<path d="M94 82 C90 70 84 62 76 60 M106 82 C110 70 116 62 124 60" fill="none" stroke="#5b4a3a" stroke-width="2.6" stroke-linecap="round"></path>
<circle cx="75" cy="60" r="4.5" fill="#d9443e" stroke="#5b4a3a" stroke-width="1.8"></circle>
<circle cx="125" cy="60" r="4.5" fill="#5b9fe0" stroke="#5b4a3a" stroke-width="1.8"></circle>
<circle cx="100" cy="94" r="20" fill="#fde9c9" stroke="#5b4a3a" stroke-width="3"></circle>
<ellipse cx="93" cy="92" rx="4.8" ry="6" fill="#2b1d16"></ellipse>
<ellipse cx="107" cy="92" rx="4.8" ry="6" fill="#2b1d16"></ellipse>
<circle cx="94.8" cy="89.4" r="1.9" fill="#ffffff"></circle>
<circle cx="108.8" cy="89.4" r="1.9" fill="#ffffff"></circle>
<ellipse cx="86" cy="101" rx="4.5" ry="2.8" fill="#f08a8a" opacity="0.8"></ellipse>
<ellipse cx="114" cy="101" rx="4.5" ry="2.8" fill="#f08a8a" opacity="0.8"></ellipse>
<path d="M96 101 Q100 106 104 101" fill="none" stroke="#2b1d16" stroke-width="2.2" stroke-linecap="round"></path>
{:else if name === 'moos'}
<rect x="4" y="4" width="192" height="272" rx="20" fill="#3f6b2a"></rect>
<g fill="#4f7f34">
<circle cx="30" cy="40" r="20"></circle><circle cx="70" cy="28" r="18"></circle><circle cx="118" cy="34" r="22"></circle><circle cx="166" cy="30" r="20"></circle>
<circle cx="40" cy="92" r="22"></circle><circle cx="92" cy="80" r="16"></circle><circle cx="146" cy="88" r="24"></circle>
<circle cx="24" cy="148" r="18"></circle><circle cx="74" cy="138" r="20"></circle><circle cx="128" cy="146" r="18"></circle><circle cx="176" cy="150" r="20"></circle>
<circle cx="44" cy="204" r="22"></circle><circle cx="100" cy="196" r="20"></circle><circle cx="156" cy="206" r="22"></circle>
<circle cx="26" cy="252" r="18"></circle><circle cx="80" cy="254" r="20"></circle><circle cx="132" cy="256" r="18"></circle><circle cx="178" cy="250" r="18"></circle>
</g>
<g fill="#6a9c45">
<circle cx="36" cy="34" r="8"></circle><circle cx="124" cy="28" r="9"></circle><circle cx="150" cy="80" r="10"></circle><circle cx="46" cy="86" r="9"></circle>
<circle cx="80" cy="132" r="8"></circle><circle cx="170" cy="144" r="8"></circle><circle cx="104" cy="190" r="9"></circle><circle cx="50" cy="198" r="8"></circle>
<circle cx="160" cy="200" r="9"></circle><circle cx="86" cy="248" r="8"></circle><circle cx="30" cy="246" r="7"></circle>
</g>
<g fill="#86b85a">
<circle cx="40" cy="30" r="3"></circle><circle cx="128" cy="24" r="3.5"></circle><circle cx="154" cy="74" r="3.5"></circle><circle cx="84" cy="128" r="3"></circle>
<circle cx="108" cy="184" r="3.5"></circle><circle cx="164" cy="196" r="3"></circle><circle cx="90" cy="244" r="3"></circle>
</g>
<circle cx="100" cy="140" r="40" fill="#35591f" stroke="#c9dd9a" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"></circle>
<path d="M100 166 V132" stroke="#d6e8a8" stroke-width="5" stroke-linecap="round"></path>
<path d="M100 144 C88 142 80 134 78 122 C90 122 98 130 100 142 Z" fill="#a9d36f" stroke="#d6e8a8" stroke-width="2" stroke-linejoin="round"></path>
<path d="M100 138 C112 136 120 128 122 116 C110 116 102 124 100 136 Z" fill="#a9d36f" stroke="#d6e8a8" stroke-width="2" stroke-linejoin="round"></path>
<rect x="34" y="226" width="6" height="12" rx="3" fill="#f6ead6"></rect>
<path d="M28 228 Q37 214 46 228 Z" fill="#d9443e"></path>
<circle cx="35" cy="223" r="1.6" fill="#ffffff"></circle>
<rect x="160" y="62" width="5" height="10" rx="2.5" fill="#f6ead6"></rect>
<path d="M155 64 Q162.5 52 170 64 Z" fill="#f2b530"></path>
<path d="M150 252 C150 238 156 228 166 224 M156 244 q-7 -3 -9 -9 M159 236 q-7 -4 -7 -10 M160 246 q6 -5 12 -4 M163 238 q5 -6 11 -6" fill="none" stroke="#a9d36f" stroke-width="2.4" stroke-linecap="round"></path>
<g fill="#fff3a6">
<circle cx="56" cy="62" r="2.5"></circle><circle cx="150" cy="122" r="2"></circle><circle cx="62" cy="176" r="2"></circle><circle cx="120" cy="226" r="2.5"></circle>
</g>
<g fill="#fff3a6" opacity="0.25">
<circle cx="56" cy="62" r="7"></circle><circle cx="150" cy="122" r="6"></circle><circle cx="62" cy="176" r="6"></circle><circle cx="120" cy="226" r="7"></circle>
</g>
<rect x="4" y="4" width="192" height="272" rx="20" fill="none" stroke="#2f4a18" stroke-width="5"></rect>
<rect x="12" y="12" width="176" height="256" rx="14" fill="none" stroke="#a9c97c" stroke-width="1.5" opacity="0.5"></rect>
{/if}
