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
