<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Décrivez un petit jeu en une phrase — jouez-y dans la barre latérale d'une conversation <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>, intégrez de l'art IA, exportez un seul fichier HTML.</strong><br />
  <sub>10 outils d'agent &bull; aperçu en direct dans la barre latérale &bull; modèles 2D et 3D voxel &bull; art OpenAI ou Codex avec vérification du coût au préalable &bull; tests de jeu autonomes &bull; historique des versions &bull; export en un seul fichier</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <b>Français</b> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Paquet : <code>@zseven-w/dsh-game-studio</code> &middot; Version actuelle du plugin : <code>0.1.0-rc.3</code> &middot; Testé avec DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — une phrase, un jeu jouable" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Un jeu 3D en cours d'exécution dans la barre latérale de Game Studio, avec des candidats d'art IA prêts à être appliqués" width="100%" />
</p>
<p align="center"><sub>Le jeu tourne dans la barre latérale droite pendant que l'agent travaille ; les candidats d'art IA numérotés attendent dessous que vous fassiez votre choix</sub></p>

## Pourquoi DSH Game Studio

Demandez un jeu à l'agent en mots simples — « un jeu 3D : un panda roux récolte des pousses de bambou dans une forêt et évite les sangliers » — et il en construit un à partir d'un modèle, y joue pour vérifier qu'il fonctionne et l'affiche dans une barre latérale où vous pouvez jouer immédiatement. Les personnages commencent comme des modèles dessinés par code ; quand vous voulez de vraies illustrations, l'agent génère des candidats avec OpenAI ou votre connexion Codex, vous en choisissez un par numéro, et le jeu l'intègre. Chaque modification est une version à laquelle vous pouvez revenir, et le jeu terminé s'exporte en un seul fichier HTML hors ligne.

| | |
| --- | --- |
| 🎮 **Jouable dès la première réponse** | Deux modèles — un jeu 2D en vue de dessus et la même boucle dans un monde voxel 3D (three.js) — que l'agent transforme en le jeu que vous avez décrit : personnages, règles, niveaux, écrans. |
| 🖥️ **Aperçu en direct dans la barre latérale** | Le jeu s'exécute dans un panneau isolé à côté de la conversation, se reconstruit à chaque modification et liste en dessous les emplacements d'illustration, les candidats et les versions. Les jeux en mode paysage bénéficient d'une scène large. |
| 🎨 **Vos propres illustrations, avec vérification du coût au préalable** | `game_studio_generate_asset` crée des candidats numérotés par emplacement avec l'API d'images d'OpenAI ou le CLI Codex local. Avant toute dépense, vous recevez une carte d'approbation indiquant le service, le nombre d'images et le coût prévu. Une image jointe dans la conversation peut servir de référence. |
| 🤖 **Tests de jeu autonomes** | `game_studio_playtest` joue le code le plus récent dans un Chrome ou Edge headless et rapporte les phases, le score, la fréquence d'images, les erreurs de script et des captures d'écran. Les jeux qui ne se pilotent pas aux touches fléchées (grilles, cartes, visée, rythme…) définissent `window.__autoplay`, afin que le test joue leur vraie boucle. |
| 🕰️ **Historique des versions** | Chaque build qui a modifié le jeu est enregistré ; `game_studio_restore_version` restaure code, règles et illustrations ensemble. |
| 📦 **Export en un seul fichier** | `game_studio_export` écrit un fichier HTML autonome sans accès réseau — ouvrez-le dans n'importe quel navigateur ou déposez-le sur n'importe quel hébergement statique. |
| 📱 **Essayez-le sur votre téléphone** | `game_studio_share` ouvre un lien temporaire en lecture seule sur votre réseau local, avec un code QR dans la barre latérale. |
| 🗂️ **Mes jeux** | Ouvrez le **+** de la barre latérale et choisissez **Game Studio · My games** : chaque jeu de l'espace de travail en vignette, avec l'image de son dernier test, filtrable 2D/3D et triable par date, versions ou nom. Un clic pour jouer — sans agent, sans jetons. **Export wall** réunit les jeux affichés dans une seule page hors ligne à envoyer à des amis. |

## Des jeux faits avec

Quatre jeux issus de nos tests. Chacun est parti de la phrase indiquée dessous, dans une session neuve (consignes traduites du chinois) ; certains ont ensuite été retouchés par d'autres demandes dans la même session, comme indiqué. Les parties sont enregistrées avec le pilote automatique de chaque jeu.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Renard au clair de lune : l'île aux lanternes — modèle voxel 3D, partie réelle" width="640" />
</p>
<p align="center"><sub>Renard au clair de lune : l'île aux lanternes — modèle voxel 3D, partie réelle</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Fais un petit jeu : un renardeau ramasse des lanternes dans une forêt au clair de lune et évite des monstres d'épines." width="100%" /><br /><sub>“Fais un petit jeu : un renardeau ramasse des lanternes dans une forêt au clair de lune et évite des monstres d'épines.”<br />Modèle 2D ; personnages remplacés ensuite par des visuels IA choisis</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Fais un jeu en 3D : un renardeau ramasse des lanternes sur une île en voxels et évite des monstres d'épines." width="100%" /><br /><sub>“Fais un jeu en 3D : un renardeau ramasse des lanternes sur une île en voxels et évite des monstres d'épines.”<br />Modèle voxel 3D ; la lanterne a été refaite lors d'une demande ultérieure</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Fais un jeu en 3D : un petit manchot ramasse des poissons sur un iceberg et évite des phoques." width="100%" /><br /><sub>“Fais un jeu en 3D : un petit manchot ramasse des poissons sur un iceberg et évite des phoques.”<br />3D ; le bonnet rouge vient d'une demande ultérieure</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Fais un jeu en 3D : un panda roux ramasse des pousses de bambou dans une bambouseraie et évite des sangliers." width="100%" /><br /><sub>“Fais un jeu en 3D : un panda roux ramasse des pousses de bambou dans une bambouseraie et évite des sangliers.”<br />3D ; personnages remplacés ensuite par des visuels IA, la forêt reste en 3D</sub></td>
</tr>
</table>

## Efficacité constatée

Mesuré dans un vrai DSH avec DeepSeek-V4.1-Flash, chaque jeu créé à partir d'une phrase dans une session neuve, évalué par un test de jeu indépendant (2026-11-04/05) :

- **Jeux de collecte et d'esquive** (le terrain de prédilection des modèles) : 10 demandes différentes sur 10 étaient jouables au premier essai, médiane d'environ 14 minutes par jeu.
- **Autres genres** — match-3, pousser des caisses, tower defense, basket-ball, plateformer, rythme, course, combat de cartes, ferme, gestion de café : les 10 se sont révélés jouables, mais ont demandé une médiane d'environ 26 minutes. Après l'ajout de `__autoplay`, d'emplacements d'illustration personnalisés et de la prise en charge du mode paysage, quatre d'entre eux ont été relancés et ont pris 8 à 18 minutes. L'échantillon est petit.

## Outils

| Outil | Ce qu'il fait |
| --- | --- |
| `game_studio_create` | Crée un jeu jouable à partir du modèle `collector` (2D) ou `voxel` (3D), le compile et l'affiche dans la barre latérale. Prend le titre, un style graphique, `orientation` (portrait ou paysage) et `slots` — les emplacements d'illustration propres au jeu, nommés dans la langue de l'utilisateur. |
| `game_studio_build` | Recompile après la modification de `game.json` ou `game.js`, rafraîchit l'aperçu et enregistre une version avec une courte note. |
| `game_studio_playtest` | Joue le code le plus récent en mode headless (portrait au format téléphone ou paysage 960×540) et rapporte les phases, le meilleur score, les cœurs, les fps, les erreurs et des captures d'écran ; `characters: true` renvoie uniquement des gros plans des personnages. |
| `game_studio_generate_asset` | Génère 1 à 4 images candidates pour un emplacement avec `openai` ou `codex`, en suivant facultativement une image de référence. Demande une approbation avant toute dépense. Codex s'exécute en arrière-plan. |
| `game_studio_apply_asset` | Intègre un candidat dans le jeu par son numéro, recompile et rafraîchit. |
| `game_studio_revert_asset` | Revient à l'illustration précédente d'un emplacement. |
| `game_studio_versions` | Liste les versions enregistrées, de la plus récente à la plus ancienne. |
| `game_studio_restore_version` | Restaure une version antérieure du jeu entier. |
| `game_studio_export` | Exporte un seul fichier HTML autonome et hors ligne. |
| `game_studio_share` | Ouvre (ou ferme) un lien temporaire en lecture seule sur le réseau local pour qu'un téléphone puisse jouer au jeu. |
| `game_studio_list` | Liste les jeux de l'espace de travail avec titre, 2D/3D, état de build et versions, pour que l'agent trouve « le jeu du manchot » par son nom. |
| `game_studio_export_wall` | Exporte le mur de jeux : une page HTML hors ligne avec une vignette par jeu construit ; un clic sur une vignette pour y jouer. |

Les boutons de la barre latérale (appliquer, annuler, compiler, exporter, restaurer, partager) appellent les mêmes opérations via la commande `/game-studio`.

## Services d'images et dépenses

| Service | Ce qu'il requiert | Coût | Remarques |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Une clé API dans les identifiants DSH ou l'environnement (`OPENAI_API_KEY` par défaut) | Facturé à votre clé par image ; la carte d'approbation affiche une estimation | Environ une minute par lot. `openaiBaseUrl` accepte une passerelle compatible OpenAI. |
| **Codex CLI** | Codex installé et connecté (`codex login`) | Compte sur votre offre Codex ; pas de clé API | Plusieurs minutes par image, s'exécute en arrière-plan et signale quand c'est terminé. |

`imageProvider: auto` (par défaut) utilise OpenAI lorsque sa clé est définie, et Codex sinon. Avec `confirmSpending` activé (par défaut), rien n'est généré tant que vous n'approuvez pas la carte. Les sprites sont vérifiés pour l'arrière-plan transparent et le cadrage, puis ajustés à l'emplacement avant d'être proposés.

## Sécurité et confidentialité

- Les jeux s'exécutent dans une iframe isolée avec une politique de sécurité du contenu qui bloque l'accès réseau ; les fichiers exportés n'émettent aucune requête réseau.
- Les seuls éléments envoyés hors de votre machine sont les prompts — et l'image de référence, si vous en fournissez une — vers le service d'images que vous choisissez.
- Le lien de partage est en lecture seule, ne sert que le build de ce jeu, n'écoute que sur votre réseau local et se ferme après le délai que vous définissez (30 minutes par défaut).
- Les clés API sont lues depuis les identifiants DSH ou l'environnement et ne sont jamais écrites dans les projets, les journaux ou les résultats d'outils.

## Prérequis

- DeepSeek Harness `0.2.1` ou version ultérieure (web ou bureau), Node.js `24.11` ou version ultérieure.
- Google Chrome ou Microsoft Edge sur le même ordinateur pour les tests de jeu.
- Pour l'art IA, soit une clé API OpenAI, soit le CLI Codex connecté. Sans aucun des deux, les jeux fonctionnent quand même avec leurs personnages dessinés par code.

## Installer dans DSH

Installez-le depuis npm dans un profil DSH :

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Démarrage rapide

Ouvrez une session dans un dossier d'espace de travail et demandez, par exemple :

- `Crée un petit jeu : un chaton vole du poisson séché dans une cuisine sans se heurter au robot aspirateur.`
- `Crée un jeu 3D : un petit chevalier récolte des pièces dans un château et évite les squelettes ; récolter 20 pièces en 60 secondes fait gagner.`
- `Crée un jeu de match-3 sur une grille de 6×6 ; atteins 1000 points en 60 secondes pour gagner.`

Essayez ensuite :

- `Génère 2 nouvelles illustrations pour le héros avec l'IA ; je choisirai dans la barre latérale.`
- `Suis l'image que j'ai jointe pour l'apparence du héros.`
- `Exporte-le en un seul fichier HTML.`

## Configuration

Définissez ces options sous `config` dans le `cordis.patch.yml` de votre profil :

| Option | Valeur par défaut | Signification |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` ou `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | Modèle d'images OpenAI ; fixez-le pour que les résultats restent comparables. |
| `openaiBaseUrl` | OpenAI | URL de base compatible OpenAI, p. ex. une passerelle d'entreprise. |
| `openaiCredential` | `OPENAI_API_KEY` | Nom de l'identifiant ou de la variable d'environnement contenant la clé. |
| `codexPath` | trouvé sur `PATH` ou via le shell de connexion | Exécutable du CLI Codex. |
| `codexModel` | par défaut de Codex | Modèle pour les générations d'images Codex. |
| `codexReasoningEffort` | `low` | Effort de raisonnement pour les générations d'images Codex. |
| `codexTimeoutMinutes` | `15` | Abandonne une image Codex après ce délai. |
| `confirmSpending` | `true` | Demande une approbation avant chaque génération. |

## Format du projet de jeu

Chaque jeu est un simple dossier dans votre espace de travail :

- `game.json` — titre, style graphique, orientation, emplacements d'illustration et règles. Les règles sont libres : toute clé est transmise au jeu comme `window.GAME.rules`.
- `game.js` — le code du jeu que l'agent modifie. Il expose `window.__gameState()` pour les tests de jeu, facultativement `window.__autoplay(state)` pour les jeux qui ne se pilotent pas aux touches fléchées, et `window.__renderSlots(size)` afin que la barre latérale affiche les personnages dessinés par code (le modèle 2D les dessine dans `drawCharacter()`).
- `assets/` — l'image de chaque emplacement plus `ASSETS.json`, le relevé de la provenance de chacune. Vous pouvez dessiner directement sur le fichier d'un emplacement ; le studio l'enregistre comme votre modification.
- `dist/index.html` — le build actuel ; `.studio/` contient les versions, les candidats et les sessions de test.

## Développement

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Écosystème

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — répartit du travail vers des agents DSH depuis Claude Code / Codex
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — un simulateur iOS ou un iPhone en USB en direct dans la conversation
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — un émulateur Android ou un appareil USB en direct dans la conversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — mémoire à long terme pour DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecte et modifie des documents de conception `.op` au sein d'une conversation

## Crédits &amp; Licence

- [three.js](https://github.com/mrdoob/three.js) — le moteur 3D intégré aux jeux voxel (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — le code QR dans le panneau de partage de la barre latérale (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — pilote le navigateur pour les tests de jeu (Apache-2.0 ; dépendance d'exécution).
- Les modèles, sprites et modèles voxel sont une création originale de ce projet.
- Voir [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) pour les notices complètes.

**Licence** : MIT
