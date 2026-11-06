<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Beschreibe ein kleines Spiel in einem Satz — spiele es in der Seitenleiste einer <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>-Konversation, tausche KI-Grafiken ein, exportiere eine HTML-Datei.</strong><br />
  <sub>10 Agent-Tools &bull; Live-Vorschau in der Seitenleiste &bull; 2D- und 3D-Voxel-Vorlagen &bull; OpenAI- oder Codex-Grafiken mit vorheriger Kostenprüfung &bull; selbstspielende Playtests &bull; Versionsverlauf &bull; Ein-Datei-Export</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <b>Deutsch</b> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Paket: <code>@zseven-w/dsh-game-studio</code> &middot; Aktuelles Plugin-Release: <code>0.1.0-rc.3</code> &middot; Getestet mit DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — ein Satz, ein spielbares Spiel" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Ein 3D-Spiel läuft in der Game-Studio-Seitenleiste, mit KI-Grafik-Kandidaten, die zum Anwenden bereitstehen" width="100%" />
</p>
<p align="center"><sub>Das Spiel läuft in der rechten Seitenleiste, während der Agent arbeitet; nummerierte KI-Grafik-Kandidaten warten darunter darauf, dass du sie auswählst</sub></p>

## Warum DSH Game Studio

Bitte den Agenten in einfachen Worten um ein Spiel — „ein 3D-Spiel: ein roter Panda sammelt Bambussprossen in einem Wald und weicht Wildschweinen aus" — und er baut eines aus einer Vorlage, spielt es zur Kontrolle durch und zeigt es in einer Seitenleiste an, in der du sofort spielen kannst. Figuren starten als im Code gezeichnete Modelle; wenn du echte Grafiken willst, erzeugt der Agent Kandidaten mit OpenAI oder deiner Codex-Anmeldung, du wählst eine per Nummer aus, und das Spiel tauscht sie ein. Jede Änderung ist eine Version, zu der du zurückkehren kannst, und das fertige Spiel lässt sich als einzelne Offline-HTML-Datei exportieren.

| | |
| --- | --- |
| 🎮 **Ab der ersten Antwort spielbar** | Zwei Vorlagen — ein 2D-Top-down-Spiel und dieselbe Schleife in einer 3D-Voxel-Welt (three.js) — die der Agent zu dem von dir beschriebenen Spiel umbaut: Figuren, Regeln, Level, Bildschirme. |
| 🖥️ **Live-Vorschau in der Seitenleiste** | Das Spiel läuft in einem Sandbox-Panel neben der Konversation, wird bei jeder Änderung neu gebaut und listet darunter die Grafik-Slots, Kandidaten und Versionen auf. Querformat-Spiele bekommen eine breite Bühne. |
| 🎨 **Eigene Grafiken, mit vorheriger Kostenprüfung** | `game_studio_generate_asset` erzeugt nummerierte Kandidaten pro Slot über die OpenAI-Bild-API oder das lokale Codex CLI. Bevor etwas ausgegeben wird, erhältst du eine Freigabekarte mit Dienst, Bildanzahl und erwarteten Kosten. Ein Bild, das du im Chat anhängst, kann als Referenz dienen. |
| 🤖 **Selbstspielende Playtests** | `game_studio_playtest` spielt den neuesten Code in einem Headless-Chrome oder -Edge und berichtet Phasen, Punkte, Bildrate, Skriptfehler und Screenshots. Spiele, die nicht mit Pfeiltasten gesteuert werden (Raster, Karten, Zielen, Rhythmus…), definieren `window.__autoplay`, damit der Playtest ihre echte Schleife spielt. |
| 🕰️ **Versionsverlauf** | Jeder Build, der das Spiel verändert hat, wird gespeichert; `game_studio_restore_version` bringt Code, Regeln und Grafiken gemeinsam zurück. |
| 📦 **Ein-Datei-Export** | `game_studio_export` schreibt eine in sich geschlossene HTML-Datei ohne Netzwerkzugriff — öffne sie in einem beliebigen Browser oder lade sie auf einen beliebigen statischen Host. |
| 📱 **Probiere es auf deinem Telefon** | `game_studio_share` öffnet einen temporären, schreibgeschützten Link in deinem lokalen Netzwerk, mit QR-Code in der Seitenleiste. |
| 🗂️ **Meine Spiele** | Über das **+** der Seitenleiste **Game Studio · My games** wählen: jedes Spiel im Arbeitsbereich als Kachel mit dem Bild des letzten Testlaufs, filterbar nach 2D/3D und sortierbar nach Datum, Versionen oder Name. Ein Klick zum Spielen – ohne Agent, ohne Tokens. **Export wall** packt die angezeigten Spiele in eine Offline-Seite zum Weiterschicken. |

## Damit gebaute Spiele

Vier Spiele aus unseren Testläufen. Jedes begann mit dem Satz darunter in einer neuen Sitzung (Prompts aus dem Chinesischen übersetzt); bei einigen haben spätere Anfragen in derselben Sitzung nachgebessert, wie vermerkt. Aufgenommen mit dem eingebauten Autoplay des jeweiligen Spiels.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Mondscheinfuchs: Laterneninsel — 3D-Voxel-Vorlage, echtes Gameplay" width="640" />
</p>
<p align="center"><sub>Mondscheinfuchs: Laterneninsel — 3D-Voxel-Vorlage, echtes Gameplay</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Mach ein kleines Spiel: Ein kleiner Fuchs sammelt Laternen in einem mondhellen Wald und weicht Dornenmonstern aus." width="100%" /><br /><sub>“Mach ein kleines Spiel: Ein kleiner Fuchs sammelt Laternen in einem mondhellen Wald und weicht Dornenmonstern aus.”<br />2D-Vorlage; Figuren später gegen ausgewählte KI-Grafiken getauscht</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Mach ein 3D-Spiel: Ein kleiner Fuchs sammelt Laternen auf einer Voxel-Insel und weicht Dornenmonstern aus." width="100%" /><br /><sub>“Mach ein 3D-Spiel: Ein kleiner Fuchs sammelt Laternen auf einer Voxel-Insel und weicht Dornenmonstern aus.”<br />3D-Voxel-Vorlage; das Laternenmodell wurde in einer späteren Anfrage neu gebaut</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Mach ein 3D-Spiel: Ein kleiner Pinguin sammelt Fische auf einem Eisberg und weicht Robben aus." width="100%" /><br /><sub>“Mach ein 3D-Spiel: Ein kleiner Pinguin sammelt Fische auf einem Eisberg und weicht Robben aus.”<br />3D; die rote Mütze kam mit einer späteren Anfrage</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Mach ein 3D-Spiel: Ein Roter Panda sammelt Bambussprossen in einem Bambuswald und weicht Wildschweinen aus." width="100%" /><br /><sub>“Mach ein 3D-Spiel: Ein Roter Panda sammelt Bambussprossen in einem Bambuswald und weicht Wildschweinen aus.”<br />3D; Figuren später gegen KI-Grafiken getauscht, der Wald bleibt 3D</sub></td>
</tr>
</table>

## Wie gut es funktioniert

Gemessen in einem echten DSH mit DeepSeek-V4.1-Flash, jedes Spiel aus einem Satz in einer frischen Session erzeugt, bewertet durch einen unabhängigen Playtest (2026-11-04/05):

- **Sammel-und-Ausweich-Spiele** (das Heimterritorium der Vorlagen): 10 von 10 verschiedenen Anfragen waren beim ersten Versuch spielbar, Median etwa 14 Minuten pro Spiel.
- **Andere Genres** — Match-3, Kistenschieben, Tower Defense, Basketball, Jump-'n'-Run, Rhythmus, Rennspiel, Kartenduell, Farming, Café-Management: alle 10 wurden spielbar, brauchten aber im Median etwa 26 Minuten. Nach dem Hinzufügen von `__autoplay`, eigenen Grafik-Slots und Querformat-Unterstützung wurden vier davon erneut ausgeführt und brauchten 8–18 Minuten. Die Stichprobe ist klein.

## Tools

| Tool | Was es tut |
| --- | --- |
| `game_studio_create` | Erzeugt aus der Vorlage `collector` (2D) oder `voxel` (3D) ein spielbares Spiel, baut es und zeigt es in der Seitenleiste an. Nimmt den Titel, einen Grafikstil, `orientation` (Hoch- oder Querformat) und `slots` — die eigenen Grafik-Slots des Spiels, benannt in der Sprache des Nutzers. |
| `game_studio_build` | Baut nach der Bearbeitung von `game.json` oder `game.js` neu, aktualisiert die Vorschau und speichert eine Version mit einer kurzen Notiz. |
| `game_studio_playtest` | Spielt den neuesten Code headless (handyförmiges Hochformat oder 960×540 Querformat) und berichtet Phasen, Bestwert, Herzen, fps, Fehler und Screenshots; `characters: true` liefert nur Nahaufnahmen der Figuren. |
| `game_studio_generate_asset` | Erzeugt 1–4 Kandidatenbilder für einen Slot mit `openai` oder `codex`, optional anhand eines Referenzbilds. Fragt vor Ausgaben nach Freigabe. Codex läuft im Hintergrund. |
| `game_studio_apply_asset` | Übernimmt einen Kandidaten anhand seiner Nummer ins Spiel, baut neu und aktualisiert. |
| `game_studio_revert_asset` | Kehrt zur vorherigen Grafik eines Slots zurück. |
| `game_studio_versions` | Listet gespeicherte Versionen auf, neueste zuerst. |
| `game_studio_restore_version` | Stellt eine frühere Version des gesamten Spiels wieder her. |
| `game_studio_export` | Exportiert eine in sich geschlossene, offline HTML-Datei. |
| `game_studio_share` | Öffnet (oder schließt) einen temporären, schreibgeschützten Link im lokalen Netzwerk, damit ein Telefon das Spiel spielen kann. |
| `game_studio_list` | Listet die Spiele im Arbeitsbereich mit Titel, 2D/3D, Build-Stand und Versionen, damit der Agent „das Pinguin-Spiel“ beim Namen findet. |
| `game_studio_export_wall` | Exportiert die Spielewand: eine Offline-HTML-Seite mit einer Kachel pro gebautem Spiel; ein Klick auf eine Kachel startet es. |

Die Schaltflächen der Seitenleiste (Anwenden, Zurücksetzen, Bauen, Exportieren, Wiederherstellen, Teilen) rufen dieselben Operationen über den Befehl `/game-studio` auf.

## Bilddienste und Ausgaben

| Dienst | Was er benötigt | Kosten | Hinweise |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Ein API-Schlüssel in den DSH-Credentials oder der Umgebung (standardmäßig `OPENAI_API_KEY`) | Wird pro Bild auf deinen Schlüssel abgerechnet; die Freigabekarte zeigt eine Schätzung | Etwa eine Minute pro Batch. `openaiBaseUrl` akzeptiert ein OpenAI-kompatibles Gateway. |
| **Codex CLI** | Codex installiert und angemeldet (`codex login`) | Zählt auf deinen Codex-Tarif; kein API-Schlüssel | Mehrere Minuten pro Bild, läuft im Hintergrund und meldet sich zurück, sobald es fertig ist. |

`imageProvider: auto` (die Voreinstellung) verwendet OpenAI, wenn dessen Schlüssel gesetzt ist, andernfalls Codex. Mit aktiviertem `confirmSpending` (die Voreinstellung) wird nichts erzeugt, bis du die Karte freigibst. Sprites werden auf transparenten Hintergrund und Rahmung geprüft und an den Slot angepasst, bevor sie angeboten werden.

## Sicherheit und Datenschutz

- Spiele laufen in einem Sandbox-iframe mit einer Content-Security-Policy, die Netzwerkzugriff blockiert; exportierte Dateien stellen keine Netzwerkanfragen.
- Die einzigen Daten, die deinen Rechner verlassen, sind die Prompts — und das Referenzbild, falls du eines angibst — an den Bilddienst, den du wählst.
- Der Share-Link ist schreibgeschützt, liefert nur den Build dieses einen Spiels, lauscht ausschließlich in deinem lokalen Netzwerk und schließt nach der von dir festgelegten Zeit (standardmäßig 30 Minuten).
- API-Schlüssel werden aus den DSH-Credentials oder der Umgebung gelesen und niemals in Projekte, Logs oder Tool-Ergebnisse geschrieben.

## Voraussetzungen

- DeepSeek Harness `0.2.1` oder neuer (Web oder Desktop), Node.js `24.11` oder neuer.
- Google Chrome oder Microsoft Edge auf demselben Rechner für Playtests.
- Für KI-Grafiken entweder ein OpenAI-API-Schlüssel oder das angemeldete Codex CLI. Ohne eines von beiden funktionieren Spiele weiterhin mit ihren im Code gezeichneten Figuren.

## In DSH installieren

Installiere es von npm in ein DSH-Profil:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Schnellstart

Öffne eine Session in einem Workspace-Ordner und frage zum Beispiel:

- `Mach ein kleines Spiel: Ein Kätzchen stiehlt in einer Küche getrockneten Fisch, ohne mit dem Saugroboter zusammenzustoßen.`
- `Mach ein 3D-Spiel: Ein kleiner Ritter sammelt Münzen in einem Schloss und weicht Skeletten aus; 20 Münzen in 60 Sekunden zu sammeln gewinnt.`
- `Mach ein Match-3-Spiel auf einem 6×6-Raster; erreiche 1000 Punkte in 60 Sekunden, um zu gewinnen.`

Dann probiere:

- `Erzeuge 2 neue Grafiken für den Helden mit KI; ich wähle in der Seitenleiste aus.`
- `Richte dich für das Aussehen des Helden nach dem Bild, das ich angehängt habe.`
- `Exportiere es als einzelne HTML-Datei.`

## Konfiguration

Lege diese unter `config` in der `cordis.patch.yml` deines Profils fest:

| Option | Standard | Bedeutung |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` oder `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | OpenAI-Bildmodell; fixiere es, damit die Ergebnisse vergleichbar bleiben. |
| `openaiBaseUrl` | OpenAI | OpenAI-kompatible Base-URL, z. B. ein Firmen-Gateway. |
| `openaiCredential` | `OPENAI_API_KEY` | Name des Credentials oder der Umgebungsvariable, die den Schlüssel enthält. |
| `codexPath` | wird auf dem `PATH` oder über die Login-Shell gefunden | Codex-CLI-Programmdatei. |
| `codexModel` | Standard von Codex | Modell für Codex-Bildläufe. |
| `codexReasoningEffort` | `low` | Reasoning-Aufwand für Codex-Bildläufe. |
| `codexTimeoutMinutes` | `15` | Bricht ein Codex-Bild nach dieser Dauer ab. |
| `confirmSpending` | `true` | Fragt vor jeder Erzeugung nach Freigabe. |

## Format des Spielprojekts

Jedes Spiel ist ein einfacher Ordner in deinem Workspace:

- `game.json` — Titel, Grafikstil, Ausrichtung, Grafik-Slots und Regeln. Regeln sind frei geformt: Jeder Schlüssel wird als `window.GAME.rules` an das Spiel übergeben.
- `game.js` — der Spielcode, den der Agent bearbeitet. Er stellt `window.__gameState()` für Playtests bereit, optional `window.__autoplay(state)` für Spiele, die nicht mit Pfeiltasten gesteuert werden, und `window.__renderSlots(size)`, damit die Seitenleiste die im Code gezeichneten Figuren zeigt (die 2D-Vorlage zeichnet sie in `drawCharacter()`).
- `assets/` — das Bild für jeden Slot plus `ASSETS.json`, die Aufzeichnung, woher jedes stammt. Du kannst die Datei eines Slots direkt überzeichnen; das Studio erfasst das als deine Bearbeitung.
- `dist/index.html` — der aktuelle Build; `.studio/` enthält Versionen, Kandidaten und Playtest-Läufe.

## Entwicklung

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Ökosystem

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Arbeit aus Claude Code / Codex an DSH-Agenten verteilen
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — ein Live-iOS-Simulator oder ein USB-iPhone innerhalb der Konversation
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — ein Live-Android-Emulator oder ein USB-Gerät innerhalb der Konversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — Langzeitgedächtnis für DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — `.op`-Designdokumente innerhalb einer Konversation ansehen und bearbeiten

## Danksagungen &amp; Lizenz

- [three.js](https://github.com/mrdoob/three.js) — die 3D-Runtime, die in Voxel-Spiele gebündelt wird (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — der QR-Code im Share-Panel der Seitenleiste (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — steuert den Browser für Playtests (Apache-2.0; Laufzeitabhängigkeit).
- Die Vorlagen, Sprites und Voxel-Modelle sind Originalarbeiten dieses Projekts.
- Die vollständigen Hinweise findest du in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

**Lizenz**: MIT
