# Design-System – Web Games

Ziel: **einfach und übersichtlich.** Jede Seite beantwortet eine Frage zuerst
(„Was spielen wir?“, „Wer ist dabei?“, „Bin ich dran und was tue ich jetzt?“)
und hat genau **eine** Hauptaktion. Ruhige Flächen und eine Akzentfarbe; Farbe
gehört aufs Spielmaterial, nicht auf den Rahmen.

Stil: *Editorial greeting* aus dem Taste-Skill (Seed 287384562).

## Tokens (src/app.css, `:root` + `html[data-theme='dark']`)

| Token | Zweck |
| --- | --- |
| `--ground` | Seitenhintergrund (weiß / fast schwarz) |
| `--surface` | Tonale Panels, eine Stufe neben dem Grund |
| `--surface-2` | Zweite Tonstufe (Hover, gedrückte Pills) |
| `--raised` | Weiße Karte *in* einem Panel (sparsam) |
| `--border`, `--control` | Feine Kante für Karten / Eingabefelder |
| `--text`, `--muted` | Schrift; Fließtext immer in `--text` |
| `--accent-main`, `--accent-hover`, `--accent-text`, `--accent-soft` | Akzent (vom Nutzer wählbar, Standard Petrol `#1b6e66`) |
| `--positive`, `--negative`, `--warning` | Status |
| `--radius-card` 22px · `--radius-inner` 14px · `--radius-control` 999px | Radien |
| `--gap` 16px · `--pad` 20px · `--control-height` 44px | Abstände |

Schrift: **Instrument Sans** (400/500/600), Tailwind `font-sans` zeigt darauf.
Zahlen, die sich ändern: `tabular-nums` (`.ui-num`).

## Bausteine (`ui-*` Klassen in src/app.css)

- Layout: `.ui-page` (zentrierte 1100px-Spalte, 16px Rand mobil)
- Typo: `.ui-title` (h1, 28–48px, 600), `.ui-lead`, `.ui-section-title` (15px/600), `.ui-muted`
- Flächen: `.ui-panel` (Tonfläche, Radius 22, kein Rahmen, kein Schatten), `.ui-card` (weiße Karte mit 1px Kante), `.ui-card-link`
- Buttons (Pills): `.ui-btn` (neutral), `--primary` (Akzent, genau einer pro Bildschirm), `--danger` (Outline rot), `--ghost`, `--lg`, `--block`, `--icon`
- `.ui-chip`, `--accent`, `--positive`
- Formulare: `.ui-label`, `.ui-input` (≥ 16px Schrift, kein iOS-Zoom)
- `.ui-alert` (Fehler, mit `role="alert"`)
- `.ui-avatar` mit `style="--player: <hex>"`: Spieler-Identität (Initiale auf blasser Tönung der Spielerfarbe)
- `.ui-dialog-backdrop` + `.ui-dialog` (Bottom-Sheet auf dem Handy, zentriert ab 640px)

Komponenten mit eigenem `<style>` benutzen dieselben `var(--…)`-Tokens, dann
funktionieren Hell/Dunkel und Akzentfarbe automatisch.

## Regeln

- **Keine** Verläufe, Glows, Glas/Blur, Schatten auf ruhenden Elementen (nur Dialoge/Popover).
- **Keine** Mini-Labels in Großbuchstaben mit Sperrung, keine Eyebrows über Überschriften, keine Emoji.
- **Keine** Icons in farbigen Kacheln, keine Reihen gleichförmiger Icon-Karten.
- Überschriften max. 2 Zeilen; Satzschreibweise; echte Umlaute.
- Flächen trennt eine Tonstufe, keine Linie und kein Schatten. Höchstens eine Ebene Karte-in-Panel.
- Eine Primäraktion pro Bildschirm; alles andere neutral oder ghost.
- Touch: Ziele ≥ 44px, Hover nur via `@media (hover:hover) and (pointer:fine)`, Druck-Feedback `:active`.
- Mobil zuerst: 360px Breite ohne horizontalen Überlauf; Inhalte, die man im Spiel braucht, ohne Scrollen erreichbar.
- Status, der sich ändert, in `aria-live="polite"`; Fehler `role="alert"`; sichtbarer `:focus-visible`-Ring im Akzent.
- `prefers-reduced-motion`: Bewegung aus, Inhalt bleibt.

## Spiele

Spielmaterial (Karten, Würfelblatt, Seekarte) behält seine eigenen, bedeutungstragenden
Farben. Der Rahmen darum (Status, Buttons, Mitspieler) nutzt die Bausteine oben.
Einheitliches Muster pro Spiel:

1. **Statuszeile** oben: ein Satz, was jetzt zu tun ist + Chip „Du bist dran“.
2. **Tisch** (`.ui-panel`): das gemeinsame Material.
3. **Eigener Bereich**: deine Hand / dein Feld, groß.
4. **Mitspieler** kompakt (Avatar in Spielerfarbe, Name, Kennzahl), mobil als wischbarer Streifen.
