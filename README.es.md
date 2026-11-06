<p align="center">
  <img src="./docs/images/dsh-game-studio-logo.png" alt="DSH Game Studio" width="120" />
</p>

<h1 align="center">DSH Game Studio</h1>

<p align="center">
  <strong>Describe un juego pequeño en una frase — juégalo en la barra lateral de una conversación de <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>, incorpórale arte de IA y exporta un solo archivo HTML.</strong><br />
  <sub>10 herramientas de agente &bull; vista previa en vivo en la barra lateral &bull; plantillas 2D y de vóxeles 3D &bull; arte con OpenAI o Codex con verificación de costo primero &bull; pruebas de juego autónomas &bull; historial de versiones &bull; exportación en un solo archivo</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <b>Español</b> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <sub>Paquete: <code>@zseven-w/dsh-game-studio</code> &middot; Versión actual del plugin: <code>0.1.0-rc.3</code> &middot; Probado con DSH <code>0.2.1-rc.5</code></sub>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-game-studio-banner.png" alt="DSH Game Studio — una frase, un juego jugable" width="100%" />
</p>

<p align="center">
  <img src="./docs/images/dsh-game-studio-overview.png" alt="Un juego 3D corriendo en la barra lateral de Game Studio, con candidatos de arte de IA listos para aplicar" width="100%" />
</p>
<p align="center"><sub>El juego corre en la barra lateral derecha mientras el agente trabaja; los candidatos de arte de IA numerados esperan debajo a que elijas</sub></p>

## Por qué DSH Game Studio

Pídele al agente un juego en palabras sencillas — «un juego 3D: un panda rojo recolecta brotes de bambú en un bosque y esquiva jabalíes» — y este construye uno a partir de una plantilla, lo juega para comprobar que funciona y lo muestra en una barra lateral donde puedes jugarlo de inmediato. Los personajes comienzan como modelos dibujados por código; cuando quieres arte real, el agente genera candidatos con OpenAI o con tu inicio de sesión de Codex, tú eliges uno por número y el juego lo incorpora. Cada cambio es una versión a la que puedes volver, y el juego terminado se exporta como un único archivo HTML sin conexión.

| | |
| --- | --- |
| 🎮 **Jugable desde la primera respuesta** | Dos plantillas — un juego 2D de vista superior y el mismo bucle en un mundo de vóxeles en 3D (three.js) — que el agente transforma en el juego que describiste: personajes, reglas, niveles, pantallas. |
| 🖥️ **Vista previa en vivo en la barra lateral** | El juego corre en un panel aislado junto a la conversación, se recompila con cada cambio y enumera debajo los espacios de arte, los candidatos y las versiones. Los juegos en horizontal obtienen un escenario amplio. |
| 🎨 **Tu propio arte, con verificación de costo primero** | `game_studio_generate_asset` crea candidatos numerados por espacio con la API de imágenes de OpenAI o la CLI local de Codex. Antes de gastar nada recibes una tarjeta de aprobación con el servicio, la cantidad de imágenes y el costo esperado. Una imagen que adjuntes en el chat puede ser la referencia. |
| 🤖 **Pruebas de juego autónomas** | `game_studio_playtest` juega el código más reciente en un Chrome o Edge sin interfaz e informa de fases, puntuación, frecuencia de fotogramas, errores de script y capturas de pantalla. Los juegos que no se dirigen con las flechas (cuadrículas, cartas, puntería, ritmo…) definen `window.__autoplay`, de modo que la prueba de juego ejecuta su bucle real. |
| 🕰️ **Historial de versiones** | Cada compilación que cambió el juego se guarda; `game_studio_restore_version` restaura juntos el código, las reglas y el arte. |
| 📦 **Exportación en un solo archivo** | `game_studio_export` escribe un archivo HTML autosuficiente y sin acceso a la red — ábrelo en cualquier navegador o ponlo en cualquier servidor estático. |
| 📱 **Pruébalo en tu teléfono** | `game_studio_share` abre un enlace temporal de solo lectura en tu red local, con un código QR en la barra lateral. |
| 🗂️ **Mis juegos** | Abre el **+** de la barra lateral y elige **Game Studio · My games**: cada juego del espacio de trabajo como una tarjeta con la imagen de su última prueba, con filtro 2D/3D y orden por fecha, versiones o nombre. Un clic para jugar, sin agente y sin tokens. **Export wall** reúne los juegos mostrados en una sola página sin conexión para enviarla a tus amigos. |

## Juegos hechos con él

Cuatro juegos de nuestras pruebas. Cada uno empezó con la frase que aparece debajo, en una sesión nueva (instrucciones traducidas del chino); en algunos, peticiones posteriores en la misma sesión hicieron retoques, como se indica. Las partidas se grabaron con el piloto automático de cada juego.

<p align="center">
  <img src="./docs/images/dsh-game-studio-play-fox-3d.gif" alt="Zorro a la luz de la luna: la isla de los farolillos — plantilla vóxel 3D, partida real" width="640" />
</p>
<p align="center"><sub>Zorro a la luz de la luna: la isla de los farolillos — plantilla vóxel 3D, partida real</sub></p>

<table>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-moonlit-2d.jpg" alt="Haz un juego pequeño: un zorrito recoge farolillos en un bosque a la luz de la luna y esquiva monstruos de espinas." width="100%" /><br /><sub>“Haz un juego pequeño: un zorrito recoge farolillos en un bosque a la luz de la luna y esquiva monstruos de espinas.”<br />Plantilla 2D; personajes cambiados después por arte de IA elegido</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-fox-3d.jpg" alt="Haz un juego en 3D: un zorrito recoge farolillos en una isla de vóxeles y esquiva monstruos de espinas." width="100%" /><br /><sub>“Haz un juego en 3D: un zorrito recoge farolillos en una isla de vóxeles y esquiva monstruos de espinas.”<br />Plantilla vóxel 3D; el modelo del farolillo se rehízo en una petición posterior</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-penguin-3d.jpg" alt="Haz un juego en 3D: un pingüinito recoge peces en un iceberg y esquiva focas." width="100%" /><br /><sub>“Haz un juego en 3D: un pingüinito recoge peces en un iceberg y esquiva focas.”<br />3D; el gorro rojo se añadió en una petición posterior</sub></td>
<td width="50%"><img src="./docs/images/dsh-game-studio-play-panda-3d.jpg" alt="Haz un juego en 3D: un panda rojo recoge brotes de bambú en un bosque de bambú y esquiva jabalíes." width="100%" /><br /><sub>“Haz un juego en 3D: un panda rojo recoge brotes de bambú en un bosque de bambú y esquiva jabalíes.”<br />3D; personajes cambiados después por arte de IA, el bosque sigue en 3D</sub></td>
</tr>
</table>

## Qué tan bien funciona

Medido en un DSH real con DeepSeek-V4.1-Flash, cada juego creado a partir de una frase en una sesión nueva y evaluado por una prueba de juego independiente (2026-11-04/05):

- **Juegos de recolectar y esquivar** (el terreno natural de las plantillas): 10 de 10 peticiones distintas resultaron jugables al primer intento, con una mediana de unos 14 minutos por juego.
- **Otros géneros** — match-3, empuje de cajas, tower defense, baloncesto, plataformas, ritmo, carreras, combate de cartas, granja, gestión de cafetería: los 10 salieron jugables, pero tardaron una mediana de unos 26 minutos. Tras añadir `__autoplay`, espacios de arte personalizados y soporte horizontal, cuatro de ellos se volvieron a ejecutar y tardaron 8–18 minutos. La muestra es pequeña.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `game_studio_create` | Crea un juego jugable a partir de la plantilla `collector` (2D) o `voxel` (3D), lo compila y lo muestra en la barra lateral. Recibe el título, un estilo de arte, `orientation` (vertical u horizontal) y `slots` — los espacios de arte propios del juego, nombrados en el idioma del usuario. |
| `game_studio_build` | Recompila tras editar `game.json` o `game.js`, actualiza la vista previa y guarda una versión con una nota breve. |
| `game_studio_playtest` | Juega el código más reciente de forma oculta (vertical con formato de teléfono u horizontal de 960×540) e informa de fases, mejor puntuación, corazones, fps, errores y capturas de pantalla; `characters: true` devuelve solo primeros planos de los personajes. |
| `game_studio_generate_asset` | Genera 1–4 imágenes candidatas para un espacio con `openai` o `codex`, siguiendo opcionalmente una imagen de referencia. Pide aprobación antes de gastar. Codex corre en segundo plano. |
| `game_studio_apply_asset` | Coloca un candidato en el juego por su número, recompila y actualiza. |
| `game_studio_revert_asset` | Vuelve al arte anterior de un espacio. |
| `game_studio_versions` | Enumera las versiones guardadas, la más reciente primero. |
| `game_studio_restore_version` | Restaura una versión anterior del juego completo. |
| `game_studio_export` | Exporta un único archivo HTML autosuficiente y sin conexión. |
| `game_studio_share` | Abre (o cierra) un enlace temporal de solo lectura en la red local para que un teléfono pueda jugar. |
| `game_studio_list` | Lista los juegos del espacio de trabajo con título, 2D/3D, estado de compilación y versiones, para que el agente encuentre «el juego del pingüino» por su nombre. |
| `game_studio_export_wall` | Exporta el muro de juegos: una página HTML sin conexión con una tarjeta por juego compilado; haz clic en una para jugar. |

Los botones de la barra lateral (aplicar, revertir, compilar, exportar, restaurar, compartir) llaman a las mismas operaciones a través del comando `/game-studio`.

## Servicios de imágenes y gasto

| Servicio | Qué necesita | Costo | Notas |
| --- | --- | --- | --- |
| **OpenAI** (GPT Image) | Una clave de API en las credenciales de DSH o el entorno (`OPENAI_API_KEY` por defecto) | Se factura por imagen a tu clave; la tarjeta de aprobación muestra una estimación | Aproximadamente un minuto por lote. `openaiBaseUrl` acepta una pasarela compatible con OpenAI. |
| **Codex CLI** | Codex instalado y con la sesión iniciada (`codex login`) | Cuenta contra tu plan de Codex; sin clave de API | Varios minutos por imagen, corre en segundo plano y avisa al terminar. |

`imageProvider: auto` (el valor por defecto) usa OpenAI cuando su clave está definida y Codex en caso contrario. Con `confirmSpending` activado (el valor por defecto) no se genera nada hasta que apruebes la tarjeta. Los sprites se comprueban por fondo transparente y encuadre, y se ajustan al espacio antes de ofrecerse.

## Seguridad y privacidad

- Los juegos corren en un iframe aislado con una política de seguridad de contenidos que bloquea el acceso a la red; los archivos exportados no hacen peticiones de red.
- Lo único que sale de tu máquina son los prompts — y la imagen de referencia, si aportas una — hacia el servicio de imágenes que elijas.
- El enlace para compartir es de solo lectura, sirve solo la compilación de ese juego, escucha únicamente en tu red local y se cierra pasado el tiempo que configures (30 minutos por defecto).
- Las claves de API se leen de las credenciales de DSH o del entorno y nunca se escriben en proyectos, registros ni resultados de herramientas.

## Requisitos

- DeepSeek Harness `0.2.1` o posterior (web o escritorio), Node.js `24.11` o posterior.
- Google Chrome o Microsoft Edge en la misma computadora para las pruebas de juego.
- Para el arte con IA, una clave de API de OpenAI o el Codex CLI con la sesión iniciada. Sin ninguna de las dos, los juegos siguen funcionando con sus personajes dibujados por código.

## Instalar en DSH

Instálalo desde npm en un perfil de DSH:

```sh
dsh plugin --profile web add @zseven-w/dsh-game-studio@latest
dsh web
```

## Inicio rápido

Abre una sesión en una carpeta de espacio de trabajo y pide, por ejemplo:

- `Haz un juego pequeño: un gatito roba pescado seco en una cocina sin chocar con el robot aspirador.`
- `Haz un juego 3D: un pequeño caballero recolecta monedas en un castillo y evita a los esqueletos; recolectar 20 monedas en 60 segundos para ganar.`
- `Haz un juego match-3 en una cuadrícula de 6×6; alcanza 1000 puntos en 60 segundos para ganar.`

Luego prueba:

- `Genera 2 piezas de arte nuevas para el héroe con IA; yo elegiré en la barra lateral.`
- `Sigue la imagen que adjunté para el aspecto del héroe.`
- `Expórtalo como un único archivo HTML.`

## Configuración

Define estas opciones bajo `config` en el `cordis.patch.yml` de tu perfil:

| Opción | Por defecto | Significado |
| --- | --- | --- |
| `imageProvider` | `auto` | `auto`, `openai` o `codex`. |
| `openaiModel` | `gpt-image-2.5-flare` | Modelo de imágenes de OpenAI; fíjalo para que los resultados sigan siendo comparables. |
| `openaiBaseUrl` | OpenAI | URL base compatible con OpenAI, p. ej. una pasarela de empresa. |
| `openaiCredential` | `OPENAI_API_KEY` | Nombre de la credencial o de la variable de entorno que contiene la clave. |
| `codexPath` | se encuentra en `PATH` o a través del shell de inicio de sesión | Ejecutable del Codex CLI. |
| `codexModel` | el valor por defecto de Codex | Modelo para las ejecuciones de imágenes de Codex. |
| `codexReasoningEffort` | `low` | Esfuerzo de razonamiento para las ejecuciones de imágenes de Codex. |
| `codexTimeoutMinutes` | `15` | Abandona una imagen de Codex pasado este tiempo. |
| `confirmSpending` | `true` | Pide aprobación antes de cada generación. |

## Formato del proyecto de juego

Cada juego es una carpeta simple en tu espacio de trabajo:

- `game.json` — título, estilo de arte, orientación, espacios de arte y reglas. Las reglas son de forma libre: cualquier clave se pasa al juego como `window.GAME.rules`.
- `game.js` — el código del juego que edita el agente. Expone `window.__gameState()` para las pruebas de juego, opcionalmente `window.__autoplay(state)` para los juegos que no se dirigen con las flechas, y `window.__renderSlots(size)` para que la barra lateral muestre personajes dibujados por código (la plantilla 2D los dibuja en `drawCharacter()`).
- `assets/` — la imagen de cada espacio más `ASSETS.json`, el registro del origen de cada una. Puedes dibujar directamente sobre el archivo de un espacio; el estudio lo registra como tu edición.
- `dist/index.html` — la compilación actual; `.studio/` guarda las versiones, los candidatos y las ejecuciones de pruebas.

## Desarrollo

```sh
npm ci
npm run build   # lib/index.js, lib/client.js and the bundled three.js runtime
npm test        # node --test; playtest tests are skipped when no Chrome or Edge is found
```

## Ecosistema

- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — envía trabajo a los agentes de DSH desde Claude Code / Codex
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — un Simulador de iOS en vivo o un iPhone por USB dentro de la conversación
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — un emulador de Android en vivo o un dispositivo USB dentro de la conversación
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memoria a largo plazo para DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecciona y edita documentos de diseño `.op` dentro de una conversación

## Créditos &amp; licencia

- [three.js](https://github.com/mrdoob/three.js) — el runtime 3D incluido en los juegos de vóxeles (MIT).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — Kazuhiko Arase — el código QR del panel para compartir de la barra lateral (MIT).
- [Playwright](https://github.com/microsoft/playwright) (`playwright-core`) — maneja el navegador para las pruebas de juego (Apache-2.0; dependencia en tiempo de ejecución).
- Las plantillas, los sprites y los modelos de vóxeles son originales de este proyecto.
- Consulta [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) para ver los avisos completos.

**Licencia**: MIT
