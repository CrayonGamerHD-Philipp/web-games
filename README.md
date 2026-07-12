# Web Games

Eine kleine SvelteKit-App fuer temporaere Party-Spiele im Browser. Spieler koennen eine Party erstellen, per Code oder Link beitreten und gemeinsam Spiele starten.

## Features

- Party erstellen und beitreten
- Live-Updates per Server-Sent Events
- Temporaere In-Memory-Partys ohne Datenbank
- Modulares Spiele-System
- Tic-Tac-Toe
- Skyjo mit Kartenlogik, Punkten, Endscreen und Revanche-/Neues-Spiel-Flow
- Responsive UI mit Tailwind CSS

## Entwicklung

```bash
npm install
npm run dev
```

Die App laeuft dann standardmaessig auf `http://localhost:5173`.

## Checks und Build

```bash
npm run check
npm run build
```

## Spielarchitektur

Spiele liegen modular unter `src/games/<game-id>/`. UI, Typen und optionale Serverlogik eines Spiels bleiben dort zusammen.

```text
src/games/
├── registry.ts
├── tic-tac-toe/
│   ├── components/
│   │   └── Game.svelte
│   ├── config.ts
│   ├── index.ts
│   ├── server.js
│   └── types.ts
└── skyjo/
    ├── components/
    │   └── Game.svelte
    ├── config.ts
    ├── index.ts
    ├── server.js
    └── types.ts
```

Gemeinsame Systembestandteile liegen unter `src/lib/game-system/`:

- `types.ts`: gemeinsame Typen wie `GameDefinition`, `GameResult`, `GameController`
- `components/GameShell.svelte`: zentrale Spielseite mit Status, Fehlern, Navigation und Ergebnisfluss
- `components/GameResultScreen.svelte`: einheitlicher Gewinner-/Unentschieden-/Endscreen

Die Party-Route `src/routes/party/[code]/game/+page.svelte` ist nur noch der Controller fuer Live-Daten und API-Aktionen. Das konkrete Spiel wird ueber die Registry geladen.

## Neues Spiel implementieren

Minimaler Ordner:

```text
src/games/example-game/
├── components/
│   └── Game.svelte
├── config.ts
├── index.ts
├── server.js
└── types.ts
```

`types.ts` enthaelt spielspezifische Typen:

```ts
export interface ExampleMove {
  fieldIndex: number;
}

export interface ExampleSession {
  id: string;
  gameId: 'example-game';
  name: string;
  status: 'running' | 'finished';
  players: { id: string; name: string }[];
  state: {
    winnerId: string | null;
    isDraw: boolean;
  };
}
```

`components/Game.svelte` ist die Hauptkomponente. Sie bekommt Props von der zentralen Shell:

```svelte
<script lang="ts">
  import type { ExampleMove, ExampleSession } from '../types';

  export let game: ExampleSession | null = null;
  export let currentPlayerId = '';
  export let isLoading = false;
  export let onMove: (move: ExampleMove) => void = () => {};

  function play(fieldIndex: number) {
    onMove({ fieldIndex });
  }
</script>
```

`config.ts` registriert die Client-Seite des Spiels:

```ts
import type { GameDefinition } from '$lib/game-system/types';
import Game from './components/Game.svelte';
import type { ExampleMove, ExampleSession } from './types';

export const exampleGame: GameDefinition<ExampleSession, ExampleMove> = {
  id: 'example-game',
  name: 'Example Game',
  description: 'Kurze Beschreibung fuer Lobby und Detailseite.',
  component: Game,
  previewImage: '/images/example-game.png',
  minPlayers: 2,
  maxPlayers: 4
};
```

`index.ts` exportiert das Modul:

```ts
export { exampleGame as default, exampleGame } from './config';
export type { ExampleMove, ExampleSession } from './types';
```

Danach das Spiel in `src/games/registry.ts` importieren und in `games` eintragen:

```ts
import { exampleGame } from './example-game';

export const games = [ticTacToeGame, skyjoGame, exampleGame];
```

## Serverlogik fuer Partyspiele

Multiplayer-Partyspiele brauchen zusaetzlich `server.js`. Dort werden Spielmetadaten, Session-Erstellung und Zugverarbeitung exportiert:

```js
export const exampleGame = {
  id: 'example-game',
  name: 'Example Game',
  description: 'Kurze Beschreibung.',
  previewImage: '/images/example-game.png',
  minPlayers: 2,
  maxPlayers: 4
};

export function createExampleSession(players) {
  return {
    id: crypto.randomUUID(),
    gameId: exampleGame.id,
    name: exampleGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: players.slice(0, exampleGame.maxPlayers).map((player) => ({
      id: player.id,
      name: player.name
    })),
    state: {
      winnerId: null,
      isDraw: false
    }
  };
}

export function makeExampleMove(session, playerId, move) {
  if (session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }

  // Spielzug validieren und Session mutieren.
  return { session };
}
```

Anschliessend `src/lib/server/games/index.js` erweitern:

```js
import { createExampleSession, exampleGame, makeExampleMove } from '../../../games/example-game/server.js';

const gameHandlers = [
  // bestehende Spiele
  {
    definition: exampleGame,
    createSession: createExampleSession,
    applyMove: makeExampleMove
  }
];
```

Wichtig fuer fertige Runden:

- `session.status = 'finished'` setzen
- `session.state.winnerId` setzen, wenn es einen Gewinner gibt
- `session.state.isDraw = true` setzen, wenn es ein Unentschieden ist
- danach keine weiteren Zuege mehr akzeptieren

Die zentrale `GameShell` zeigt dann automatisch den gemeinsamen Ergebnisbildschirm an und bietet Revanche sowie Rueckkehr zur Spielauswahl an.

## Docker

Image bauen:

```bash
docker build -t web-games .
```

Container starten:

```bash
docker run --rm -p 3000:3000 web-games
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## Dokploy

Die App startet im Container als SvelteKit Node-Server auf Port `3000`.

In Dokploy sollte deshalb als interner Port `3000` verwendet werden. `vite preview` und Port `4173` sind nur fuer lokale Vorschau gedacht und sollten im Deployment nicht genutzt werden.

## Hinweis

Partys und Spiele werden aktuell nur im Speicher des laufenden Server-Prozesses gehalten. Ein Neustart des Servers entfernt alle aktiven Partys.
