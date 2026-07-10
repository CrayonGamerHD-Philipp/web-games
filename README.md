# Web Games

Eine kleine SvelteKit-App fuer temporaere Party-Spiele im Browser. Spieler koennen eine Party erstellen, per Code oder Link beitreten und gemeinsam Spiele starten.

## Features

- Party erstellen und beitreten
- Live-Updates per Server-Sent Events
- Temporäre In-Memory-Partys ohne Datenbank
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
npm run preview
```

## Docker

Image bauen:

```bash
docker build -t web-games .
```

Container starten:

```bash
docker run --rm -p 4173:4173 web-games
```

Danach ist die App unter `http://localhost:4173` erreichbar.

## Hinweis

Partys und Spiele werden aktuell nur im Speicher des laufenden Server-Prozesses gehalten. Ein Neustart des Servers entfernt alle aktiven Partys.