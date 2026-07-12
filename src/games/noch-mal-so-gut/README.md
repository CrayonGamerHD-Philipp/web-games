# Noch mal so gut

Eigenstaendige digitale Roll-and-Write-Umsetzung fuer das modulare Webgame-System.

## Struktur

- `types.ts`: vollstaendig typisierter Spielzustand, Wuerfel, Zuege und Wertung
- `data/boardLayouts.ts`: strukturelle Brettdefinition ohne Bildassets
- `logic/`: reine Spiellogik fuer Wuerfel, Validierung, Zugfindung, Wertung, State, Save/Load und KI
- `components/`: Svelte-UI fuer Brett, Wuerfel, Panels, Regeln und Controls
- `server.js`: Adapter fuer Partyspiele

## Regeln im Kern

Ein Zug kombiniert einen Farb- und einen Zahlenwuerfel. Die markierten Felder muessen exakt der Anzahl entsprechen, dieselbe Farbe haben und orthogonal zusammenhaengen. Der erste Zug startet in Spalte H; spaetere Zuege schliessen an eigene Markierungen an oder beginnen wieder in H. Joker verbrauchen Jokerfelder. Reihen, Spalten, Farben, Boni, Sterne und Jokerstrafen werden aus dem Zustand berechnet.

