/**
 * Playtest a project in the user's own Chrome or Edge, headless: open a fresh
 * build, let an autopilot play it through the game's `__gameState()` API, and
 * return what happened plus screenshots. Rule overrides apply to this run only;
 * the project, its dist/ build and its version history are never touched.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderHtml } from './build.ts'
import { loadLedger, loadManifest, paths, templateDir, type GameManifest } from './project.ts'
import { StudioError } from './util.ts'

/** How a game shows its code-drawn characters to the studio; told to the agent so it never has to read the plugin. */
export const RENDERS_CONTRACT = 'Sidebar thumbnails and playtest close-ups of characters drawn in code come from game.js: '
  + 'window.__renderSlots(size) returns { <slot>: "data:image/png;base64,…" } for slots that still hold template art '
  + '(transparent PNG, size×size, one character centred), and once after load the game posts '
  + '{ source: "dsh-game-studio", type: "renders", renders: __renderSlots(256) } to window.parent. '
  + 'The voxel template builds both from MODELS; the collector template from drawCharacter(g, slot, size), the one function '
  + 'that draws each character for both the game and the close-ups, so a character drawn in code belongs there. '
  + 'A game without them shows the slot files (assets/…) in the sidebar, which is right when you drew the characters into those files.'

/** What the playtest autopilot needs from game.js; told to the agent so a rewrite keeps the game testable. */
export const GAME_STATE_CONTRACT = 'The playtest autopilot reads window.__gameState(), which must return '
  + '{ phase: "title" | "playing" | "won" | "lost", score, hearts, fps, hero: { x, y }, pickups: [{ x, y }], enemies: [{ x, y }], world: { w, h } } '
  + '(positions in one world space; add heroOnScreen: false while the hero is out of view). '
  + 'It starts the round with a tap (phone) or Enter (desktop) and steers with the arrow keys. Keep this function when you rewrite game.js. '
  + 'A game not played by steering one hero with the arrow keys (grid, cards, aiming, rhythm, building, management) should also define '
  + 'window.__autoplay(state): during a playtest it is called about 10 times a second with the current __gameState() and makes one sensible move '
  + 'through the game\'s own functions (a valid swap, the first playable card, a shot at the hoop), so the playtest can play the real loop; '
  + 'players never trigger it, so it needs no rule or menu switch. Without it the autopilot only holds arrow keys toward the nearest pickup.'

export interface PlaytestOptions {
  /** How long the autopilot plays, in seconds (1–60). */
  seconds?: number
  /** Rule overrides for this run only, e.g. `{ "duration": 3 }` to reach the win screen fast. */
  rules?: Record<string, unknown>
  /** Phone-shaped 390×844 touch viewport or 960×540 landscape; default follows game.json orientation. */
  portrait?: boolean
  /** Only draw the code-drawn characters' close-ups, one image per slot, without playing. */
  charactersOnly?: boolean
  /** Device pixel ratio of the page and its screenshots. */
  scale?: number
  signal?: AbortSignal
}

export interface PlaytestShot {
  name: string
  file: string
  mediaType: 'image/jpeg' | 'image/png'
}

export interface PlaytestReport {
  runDir: string
  browser: string
  viewport: { width: number; height: number; touch: boolean }
  rules: Record<string, unknown>
  /** Phase changes in order, with seconds since the page loaded. */
  phases: Array<{ phase: string; at: number }>
  finalPhase: string
  bestScore: number
  hearts?: number
  fps?: { min: number; avg: number }
  /** Samples where the game reported the hero outside the camera's view. */
  heroOffScreen: number
  errors: string[]
  /** Requests to anything other than the file itself; a working build makes none. */
  requests: string[]
  shots: PlaytestShot[]
  /** Slots whose character the game draws in code, saved as .studio/renders/<slot>.png. */
  renders: string[]
  /** Character-only runs: slots shown from their file (what the sidebar shows) because the game drew no close-up. */
  fileSlots: string[]
  /** Slots still holding the template's art. */
  templateSlots: string[]
  /** game.js and every slot are still exactly the template's: nothing of the user's game is in it yet. */
  untouched: boolean
  /** Who played the round: the game's own window.__autoplay, or arrow keys toward the nearest pickup. */
  autoplay: 'game' | 'arrows'
  notes: string[]
  charactersOnly: boolean
  /** Whether dist/index.html (what the sidebar plays) already holds this code. */
  buildCurrent: boolean
  /** The game uses a 3D runtime, so its characters are drawn in code unless the user applied art. */
  drawsInCode: boolean
}

const KEEP_RUNS = 5
const VIEWPORTS = {
  portrait: { width: 390, height: 844, touch: true },
  landscape: { width: 960, height: 540, touch: false },
}
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const
type Dir = keyof typeof KEYS

interface GameState {
  phase: string
  score?: number
  hearts?: number
  fps?: number
  hero?: { x: number; y: number }
  pickups?: Array<{ x: number; y: number }>
  enemies?: Array<{ x: number; y: number }>
  world?: { w?: number; h?: number; size?: number }
  heroOnScreen?: boolean
}

type Playwright = typeof import('playwright-core')
type Browser = Awaited<ReturnType<Playwright['chromium']['launch']>>

async function launchBrowser(): Promise<{ browser: Browser; name: string }> {
  let chromium: Playwright['chromium']
  try { ({ chromium } = await import('playwright-core')) }
  catch { throw new StudioError('playwright-core is missing from this dsh-game-studio install', 'NO_BROWSER') }
  const tried: string[] = []
  for (const channel of ['chrome', 'msedge']) {
    try {
      const browser = await chromium.launch({ channel, headless: true })
      return { browser, name: channel === 'chrome' ? 'Google Chrome' : 'Microsoft Edge' }
    } catch (error) {
      tried.push(`${channel}: ${String((error as Error).message ?? error).split('\n')[0]}`)
    }
  }
  throw new StudioError(
    `Playtest needs Google Chrome or Microsoft Edge installed on this computer; neither could be started (${tried.join('; ')}). `
    + 'Ask the user to install one; do not try to download a browser.',
    'NO_BROWSER',
  )
}

function checkRules(defaults: Record<string, unknown>, rules: Record<string, unknown>): void {
  const unknown = Object.keys(rules).filter(key => !(key in defaults))
  if (unknown.length > 0) {
    throw new StudioError(
      `Unknown rule${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}; this game's rules are: ${Object.keys(defaults).join(', ')}`
        + (unknown.some(key => /auto|demo|bot|ai|cheat|play/iu.test(key))
          ? '. To let the playtest play the game, define window.__autoplay(state) in game.js instead of a rule; it is only called during playtests.'
          : ''),
      'BAD_RULES',
    )
  }
}

async function pruneRuns(dir: string): Promise<void> {
  const root = paths.playtests(dir)
  const runs = (await readdir(root).catch(() => [] as string[])).filter(name => name.startsWith('run-')).sort()
  for (const old of runs.slice(0, Math.max(0, runs.length - KEEP_RUNS))) {
    await rm(join(root, old), { recursive: true, force: true })
  }
}

/** One steering decision: toward the nearest pickup, away from close enemies, sideways when stuck. */
function steer(state: GameState, stuck: boolean): Set<Dir> {
  const hero = state.hero
  if (!hero) return new Set()
  const scale = state.world?.size ?? Math.max(state.world?.w ?? 0, state.world?.h ?? 0) ?? 40
  const avoid = (scale || 40) * 0.1
  let dx = 0
  let dy = 0
  let best: { x: number; y: number } | undefined
  for (const p of state.pickups ?? []) {
    if (!best || (p.x - hero.x) ** 2 + (p.y - hero.y) ** 2 < (best.x - hero.x) ** 2 + (best.y - hero.y) ** 2) best = p
  }
  if (best) {
    const d = Math.hypot(best.x - hero.x, best.y - hero.y) || 1
    dx = (best.x - hero.x) / d
    dy = (best.y - hero.y) / d
  }
  for (const e of state.enemies ?? []) {
    const d = Math.hypot(hero.x - e.x, hero.y - e.y)
    if (d > 0 && d < avoid) {
      dx += (hero.x - e.x) / d * (avoid - d) / avoid * 2
      dy += (hero.y - e.y) / d * (avoid - d) / avoid * 2
    }
  }
  if (stuck) [dx, dy] = [-dy, dx]
  const want = new Set<Dir>()
  if (dx > 0.3) want.add('right')
  if (dx < -0.3) want.add('left')
  if (dy > 0.3) want.add('down')
  if (dy < -0.3) want.add('up')
  return want
}

export async function playtest(dir: string, options: PlaytestOptions = {}): Promise<PlaytestReport> {
  const seconds = Math.min(60, Math.max(1, Math.round(options.seconds ?? 15)))
  const manifest = await loadManifest(dir)
  const rules = options.rules ?? {}
  checkRules(manifest.rules ?? {}, rules)
  const html = await renderHtml(dir, { ...manifest, rules: { ...manifest.rules, ...rules } })
  const current = Object.keys(rules).length > 0 ? await renderHtml(dir, manifest) : html
  const built = await readFile(paths.artifact(dir), 'utf8').catch(() => '')

  await mkdir(paths.playtests(dir), { recursive: true })
  await pruneRuns(dir)
  const runDir = join(paths.playtests(dir), `run-${new Date().toISOString().replace(/[:.]/gu, '-')}`)
  await mkdir(runDir, { recursive: true })
  const gameFile = join(runDir, 'game.html')
  await writeFile(gameFile, html)

  // Played the way the game is meant to be held unless the call asks otherwise.
  const landscape = options.portrait === undefined ? manifest.orientation === 'landscape' : options.portrait === false
  const viewport = landscape ? VIEWPORTS.landscape : VIEWPORTS.portrait
  const report: PlaytestReport = {
    runDir, browser: '', viewport, rules, phases: [], finalPhase: '', bestScore: 0,
    heroOffScreen: 0, errors: [], requests: [], shots: [], renders: [], fileSlots: [], notes: [],
    charactersOnly: options.charactersOnly === true,
    buildCurrent: built === current,
    drawsInCode: (manifest.runtime ?? []).length > 0 && (await templateSlots(dir, manifest)).length > 0,
    templateSlots: await templateSlots(dir, manifest),
    untouched: false,
    autoplay: 'arrows',
  }
  report.untouched = Object.values(manifest.slots).filter(spec => spec.transparent).length === report.templateSlots.length
    && await readFile(paths.code(dir), 'utf8').catch(() => '') === await readFile(join(templateDir(manifest.template), 'game.js'), 'utf8').catch(() => null)
  if (options.signal?.aborted) throw new StudioError('Playtest was cancelled', 'CANCELLED')

  const { browser, name } = await launchBrowser()
  report.browser = name
  const onAbort = () => { void browser.close().catch(() => {}) }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
      // Phone screenshots at 2× pixels so small UI text (cards, scores, menus) can be read without cropping;
      // real phones render at 2-3× anyway. The 960-wide landscape view is readable at 1×.
      deviceScaleFactor: options.scale ?? (viewport.touch ? 2 : 1),
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    const fileUrl = pathToFileURL(gameFile).href
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text().slice(0, 300)) })
    page.on('pageerror', error => { report.errors.push(String(error.message ?? error).slice(0, 300)) })
    page.on('request', request => {
      const url = request.url()
      if (url !== fileUrl && !url.startsWith('data:') && !url.startsWith('blob:')) report.requests.push(url.slice(0, 200))
    })
    const started = Date.now()
    const shot = async (shotName: string) => {
      const file = join(runDir, `${shotName}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 75 })
      report.shots.push({ name: shotName, file, mediaType: 'image/jpeg' })
    }
    const read = async (): Promise<GameState> => {
      const state = await page.evaluate('window.__gameState()') as GameState
      const last = report.phases.at(-1)
      if (!last || last.phase !== state.phase) report.phases.push({ phase: state.phase, at: Math.round((Date.now() - started) / 100) / 10 })
      report.bestScore = Math.max(report.bestScore, Number(state.score) || 0)
      if (state.heroOnScreen === false) report.heroOffScreen += 1
      return state
    }

    await page.goto(fileUrl)
    try { await page.waitForFunction('typeof window.__gameState === "function"', undefined, { timeout: 10_000 }) }
    catch {
      report.notes.push('The game never exposed window.__gameState(); the autopilot could not play it.')
      await shot('title')
      report.finalPhase = 'unknown'
      return report
    }
    await page.waitForTimeout(report.charactersOnly ? 300 : 800)
    await read()
    if (!report.charactersOnly) await shot('title')

    // Close-ups of the characters the game draws in code (templates that support it).
    // Bigger when the agent is looking at the models themselves.
    const size = report.charactersOnly ? 384 : 256
    const renders = await page.evaluate(`typeof window.__renderSlots === 'function' ? window.__renderSlots(${size}) : null`)
      .catch((error: Error) => { report.errors.push(`__renderSlots failed: ${error.message.slice(0, 200)}`); return null }) as Record<string, string> | null
    if (renders && Object.keys(renders).length > 0) {
      await mkdir(paths.renders(dir), { recursive: true })
      for (const [slot, url] of Object.entries(renders)) {
        if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) continue
        const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
        await writeFile(join(paths.renders(dir), `${slot}.png`), png)
        report.renders.push(slot)
        if (report.charactersOnly) {
          const file = join(runDir, `${slot}.png`)
          await writeFile(file, png)
          report.shots.push({ name: slot, file, mediaType: 'image/png' })
        }
      }
    }
    if (report.charactersOnly) {
      // Slots the game drew no close-up for look like their file, in the sidebar too: show that file.
      for (const [slot, spec] of Object.entries(manifest.slots)) {
        if (report.renders.includes(slot)) continue
        const data = await readFile(join(dir, spec.file)).catch(() => undefined)
        const mime = FILE_TYPES[extname(spec.file).toLowerCase()]
        if (data === undefined || mime === undefined) continue
        const png = await page.evaluate(`(async ([url, size]) => {
          const image = new Image(); image.src = url; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
          const ar = (image.naturalWidth || size) / (image.naturalHeight || size)
          const w = ar >= 1 ? size : size * ar, h = ar >= 1 ? size / ar : size
          canvas.getContext('2d').drawImage(image, (size - w) / 2, (size - h) / 2, w, h)
          return canvas.toDataURL('image/png')
        })(${JSON.stringify([`data:${mime};base64,${data.toString('base64')}`, size])})`).catch(() => null) as string | null
        if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,')) continue
        const file = join(runDir, `${slot}.png`)
        await writeFile(file, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'))
        report.shots.push({ name: slot, file, mediaType: 'image/png' })
        report.fileSlots.push(slot)
      }
      if (report.renders.length === 0 && report.fileSlots.length === 0) {
        throw new StudioError(
          report.errors.length > 0
            ? `The game's window.__renderSlots failed: ${report.errors.at(-1)}`
            : 'Could not draw any character close-up: window.__renderSlots returned nothing and no slot file could be shown.',
          'NO_RENDERS',
        )
      }
      report.finalPhase = 'title'
      return report
    }
    if (renders && Object.keys(renders).length > 0) {
      const sheet = await page.evaluate(`(async renders => {
        const slots = Object.keys(renders)
        const canvas = document.createElement('canvas')
        canvas.width = 256 * slots.length; canvas.height = 284
        const g = canvas.getContext('2d')
        g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < slots.length; i++) {
          const image = new Image(); image.src = renders[slots[i]]; await image.decode()
          g.drawImage(image, i * 256, 0, 256, 256)
          g.fillStyle = '#e8ecf4'; g.font = '16px sans-serif'; g.textAlign = 'center'
          g.fillText(slots[i], i * 256 + 128, 276)
        }
        return canvas.toDataURL('image/png')
      })(${JSON.stringify(renders)})`) as string
      const file = join(runDir, 'characters.png')
      await writeFile(file, Buffer.from(sheet.slice(sheet.indexOf(',') + 1), 'base64'))
      report.shots.push({ name: 'characters', file, mediaType: 'image/png' })
    }

    // Start the way a player would: a tap on phones, a key press on desktop.
    if (viewport.touch) await page.touchscreen.tap(viewport.width / 2, viewport.height / 2)
    else await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    let state = await read()
    if (state.phase === 'title') {
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      state = await read()
      if (state.phase === 'title') report.notes.push(viewport.touch ? 'A tap did not start the game; a key press was needed or nothing started it.' : 'Enter did not start the game.')
    }

    const selfPlay = await page.evaluate('typeof window.__autoplay === "function"').catch(() => false) === true
    if (selfPlay) report.autoplay = 'game'
    let selfPlayBroken = false
    const held = new Set<Dir>()
    const fps: number[] = []
    let last = state.hero
    let still = 0
    let midTaken = false
    const deadline = Date.now() + seconds * 1000
    while (Date.now() < deadline) {
      state = await read()
      if (state.phase !== 'playing') break
      if (typeof state.fps === 'number' && Date.now() - started > 1500) fps.push(state.fps)
      if (selfPlay) {
        if (!selfPlayBroken) {
          await page.evaluate('window.__autoplay(window.__gameState())').catch((error: Error) => {
            selfPlayBroken = true
            report.errors.push(`window.__autoplay failed: ${error.message.slice(0, 200)}`)
          })
        }
      } else {
        const moved = last && state.hero ? Math.hypot(state.hero.x - last.x, state.hero.y - last.y) : 1
        still = held.size > 0 && moved < 1e-3 * (state.world?.size ?? state.world?.w ?? 40) ? still + 1 : 0
        last = state.hero
        const want = steer(state, still >= 4)
        for (const key of held) if (!want.has(key)) { await page.keyboard.up(KEYS[key]); held.delete(key) }
        for (const key of want) if (!held.has(key)) { await page.keyboard.down(KEYS[key]); held.add(key) }
      }
      if (!midTaken && Date.now() > deadline - seconds * 500) { await shot('mid'); midTaken = true }
      await page.waitForTimeout(100)
    }
    for (const key of held) await page.keyboard.up(KEYS[key])
    if (!midTaken && report.phases.some(p => p.phase === 'playing')) report.notes.push('The round ended before the midpoint screenshot.')
    if (state.phase === 'won' || state.phase === 'lost') await page.waitForTimeout(700)
    state = await read()
    await shot('end')
    report.finalPhase = state.phase
    if (typeof state.hearts === 'number') report.hearts = state.hearts
    if (fps.length > 0) report.fps = { min: Math.min(...fps), avg: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) }
    if (state.phase === 'playing') report.notes.push(`Still playing after ${seconds}s; pass rules such as {"duration": 3} to reach the end screen quickly.`)
    return report
  } catch (error) {
    if (options.signal?.aborted) throw new StudioError('Playtest was cancelled', 'CANCELLED')
    throw error
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    await browser.close().catch(() => {})
  }
}

const FILE_TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** Character slots (sprites, not backgrounds) still holding the template's art: the only slots a game draws in code. */
async function templateSlots(dir: string, manifest: GameManifest): Promise<string[]> {
  try {
    return Object.values((await loadLedger(dir)).assets)
      .filter(record => record?.source === 'template' && manifest.slots[record.slot]?.transparent === true).map(record => record!.slot)
  } catch { return [] }
}

function fileSlotsLine(report: PlaytestReport): string {
  const template = report.fileSlots.filter(slot => report.templateSlots.includes(slot))
  return `Slot files, which the sidebar shows as they are: ${report.fileSlots.join(', ')}.`
    + (template.length > 0
      ? ` ${template.join(', ')} still hold the template's art; if game.js draws those characters in code instead, draw them in drawCharacter() and keep window.__renderSlots so the sidebar matches.`
      : ' Nothing else is needed for them.')
}

/** What the sidebar will show, so the agent never has to go looking for it. */
function sidebarLine(report: PlaytestReport): string {
  const slots = report.renders.join(', ')
  return report.buildCurrent
    ? `The sidebar already uses these as the thumbnails of ${slots}; nothing else is needed.`
    : `After game_studio_build the sidebar uses these as the thumbnails of ${slots}; nothing else is needed.`
}

/** A short plain-text account for the model. */
export function describePlaytest(report: PlaytestReport): string {
  if (report.charactersOnly) {
    return [
      ...(report.renders.length > 0 ? [`Character close-ups from the latest game code, drawn in ${report.browser}: ${report.renders.join(', ')}.`] : []),
      ...(report.fileSlots.length > 0 ? [fileSlotsLine(report)] : []),
      ...(report.errors.length > 0 ? [`Errors (${report.errors.length}):\n${report.errors.slice(0, 10).map(e => `  - ${e}`).join('\n')}`] : []),
      ...(report.renders.length > 0 ? [sidebarLine(report)] : []),
      `Images: ${report.shots.map(s => s.file).join(', ')}`,
    ].join('\n')
  }
  const lines = [
    `Playtest in ${report.browser}, ${report.viewport.width}×${report.viewport.height}${report.viewport.touch ? ' touch, screenshots at 2× pixels' : ''}`
      + (Object.keys(report.rules).length > 0 ? `, rules for this run only: ${JSON.stringify(report.rules)}` : '')
      + (report.autoplay === 'game' ? '; played by the game\'s own window.__autoplay' : '; played by arrow keys toward the nearest pickup'),
    `Phases: ${report.phases.map(p => `${p.phase}@${p.at}s`).join(' → ') || 'none'}; final: ${report.finalPhase}`,
    `Best score: ${report.bestScore}${report.hearts !== undefined ? `; hearts left: ${report.hearts}` : ''}`
      + (report.fps ? `; fps min ${report.fps.min}, avg ${report.fps.avg}` : ''),
  ]
  if (report.heroOffScreen > 0) lines.push(`Hero left the camera view in ${report.heroOffScreen} samples.`)
  lines.push(report.errors.length > 0 ? `Errors (${report.errors.length}):\n${report.errors.slice(0, 10).map(e => `  - ${e}`).join('\n')}` : 'Errors: none')
  if (report.requests.length > 0) lines.push(`Network requests (the build should make none): ${report.requests.slice(0, 5).join(', ')}`)
  if (report.renders.length > 0) lines.push(`Character close-ups: ${report.renders.join(', ')}. ${sidebarLine(report)}`)
  else if (report.drawsInCode) lines.push(`No character close-ups, so the sidebar shows the template's icon files. ${RENDERS_CONTRACT}`)
  else if (report.templateSlots.length > 0 && !report.untouched) {
    lines.push(`No character close-ups, so the sidebar shows the template's files for ${report.templateSlots.join(', ')}. `
      + 'If game.js now draws those characters in code, draw them in drawCharacter() and keep window.__renderSlots from the template so the sidebar matches; '
      + 'if you meant to keep or replace the files, nothing is needed.')
  }
  if (report.autoplay === 'arrows' && report.bestScore === 0 && report.phases.some(p => p.phase === 'playing')) {
    lines.push('The arrow-key autopilot scored nothing. If this game is not played by steering a hero with the arrow keys, '
      + 'define window.__autoplay(state) in game.js so the playtest plays its real loop (see the tool description); do not add a rule for it.')
  }
  for (const note of report.notes) lines.push(`Note: ${note}`)
  const clean = report.errors.length === 0 && report.requests.length === 0 && report.heroOffScreen === 0
    && report.phases.some(p => p.phase === 'playing') && (report.fps === undefined || report.fps.min >= 30)
  if (clean && !report.buildCurrent) lines.push('Checks passed, but the sidebar still plays an older build: call game_studio_build.')
  else if (clean && !report.untouched) {
    lines.push('All checks passed. If the game already matches what the user asked for (their characters, setting and rules), '
      + 'it is ready: export it and tell the user. More polish is optional; offer it instead of doing it unasked.')
  }
  lines.push(`Screenshots: ${report.shots.map(s => s.file).join(', ')}`)
  return lines.join('\n')
}
