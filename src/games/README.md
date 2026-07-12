# Spiele hinzufuegen

Alle Spiele liegen unter `src/games/<game-id>/`. Ein Spielmodul enthaelt seine Svelte-Hauptkomponente, optionale Unterkomponenten, spielspezifische Typen, die Client-Konfiguration und bei Multiplayer-Partyspielen die serverseitige Logik.

Minimalstruktur:

```text
src/games/example-game/
├── components/
│   └── Game.svelte
├── config.ts
├── index.ts
├── server.js
└── types.ts
```

## Client-Definition

`config.ts` exportiert eine `GameDefinition`:

```ts
import type { GameDefinition } from '$lib/game-system/types';
import Game from './components/Game.svelte';

export const exampleGame: GameDefinition = {
  id: 'example-game',
  name: 'Example Game',
  description: 'Kurze Beschreibung fuer Auswahl und Detailseite.',
  component: Game,
  previewImage: '/images/example-game.png',
  minPlayers: 2,
  maxPlayers: 4
};
```

Danach wird das Spiel in `src/games/registry.ts` importiert und in `games` eingetragen.

## Props der Hauptkomponente

Die zentrale Shell rendert die Hauptkomponente mit diesen Props:

```svelte
<script lang="ts">
  import type { GameResult } from '$lib/game-system/types';

  export let game: unknown | null = null;
  export let players = [];
  export let currentPlayerId = '';
  export let settings = {};
  export let isLoading = false;
  export let onMove: (move: Record<string, unknown>) => void = () => {};
  export let onGameFinished: (result: GameResult) => void = () => {};
</script>
```

Partyspiele senden Zuege ueber `onMove(...)`. Das Ergebnis wird bei den vorhandenen Multiplayer-Spielen serverseitig im Session-State gesetzt; die zentrale `GameShell` zeigt danach automatisch den Ergebnisbildschirm an.

## Ergebnis melden

Standalone-Spiele koennen ein Ergebnis mit dem gemeinsamen Format melden:

```ts
onGameFinished({
  status: 'won',
  winnerId: currentPlayer.id,
  winnerName: currentPlayer.name,
  message: `${currentPlayer.name} hat gewonnen.`
});
```

Ein Ergebnis darf pro Runde nur einmal gemeldet werden. Bei Partyspielen schuetzt die Serverlogik bereits vor weiteren Zuegen nach `status: 'finished'`.

## Neustart

Die Shell stellt den Neustart zentral bereit. Bei Partyspielen ruft sie die API-Aktion `restart` auf, wodurch `server.js` eine neue Session erstellt. Ein Spiel sollte lokalen UI-Zustand aus `game.id` oder einem uebergebenen Render-Schluessel ableiten, damit ein Restart sauber neu rendert.

## Server-Integration

Partyspiele exportieren in `server.js` mindestens:

```js
export const exampleGame = { id: 'example-game', name: 'Example Game', minPlayers: 2, maxPlayers: 4 };
export function createExampleSession(players) { /* ... */ }
export function makeExampleMove(session, playerId, move) { /* ... */ }
```

Dann `src/lib/server/games/index.js` um Import, `availableGames`, `createGameSession` und `applyGameMove` erweitern. Alle UI-Dateien bleiben im jeweiligen Spielordner; gemeinsame Shell, Typen und Ergebnisanzeige bleiben unter `src/lib/game-system/`.
