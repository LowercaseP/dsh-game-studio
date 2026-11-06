// The game wall export: real template games, built the way the studio builds
// them, packed into one page; plus the two agent tools and the page itself in
// a real browser.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { writeState } from '../src/assets.ts'
import { buildProject, runtimeTag } from '../src/build.ts'
import { dimensionCounts, viewGames } from '../src/client/shelf.ts'
import { createProject, paths } from '../src/project.ts'
import { listVersions } from '../src/versions.ts'
import { exportWall, listGames } from '../src/wall.ts'

// The Harness supplies @deepseek-ai/dsh-tools; here defineTool only needs to hand the definition back.
const toolsStub = `data:text/javascript,${encodeURIComponent('export function defineTool(definition) { return definition }')}`
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-tools') return { url: toolsStub, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'game-wall-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function makeGame(root, dir, options, { build = true } = {}) {
  const path = join(root, dir)
  await createProject(path, options)
  if (build) await writeState(path, await buildProject(path, 'Created'))
  else await writeState(path)
  return path
}

/** The page's data, read the way the page reads it: the text of one script element. */
function pageData(page) {
  const match = /<script type="application\/json" id="data">([\s\S]*?)<\/script>/u.exec(page)
  assert.ok(match, 'the data element is intact')
  return JSON.parse(match[1])
}

test('the wall packs every built game unchanged, with one shared copy of the 3D runtime', async (t) => {
  const root = await workspace(t)
  const flat = await makeGame(root, 'moon', { title: '月光花园' })
  const cube = await makeGame(root, 'isle', { title: 'Lantern Isle', template: 'voxel' })
  const cube2 = await makeGame(root, 'more/isle-2', { title: 'Second Isle', template: 'voxel' })
  await makeGame(root, 'draft', { title: 'Draft' }, { build: false })
  const before = await Promise.all([flat, cube, cube2].map(async dir => ({
    html: await readFile(paths.artifact(dir), 'utf8'), mtime: (await stat(paths.artifact(dir))).mtimeMs, versions: (await listVersions(dir)).length,
  })))

  const result = await exportWall({ root })
  assert.equal(result.file, join(root, 'export', 'game-wall.html'))
  assert.equal(result.games, 3)
  assert.deepEqual(result.skipped, [{ path: 'draft', reason: 'not built yet' }])
  const page = await readFile(result.file, 'utf8')
  assert.equal(Buffer.byteLength(page), result.bytes)
  assert.match(page, /<html lang="zh-CN">/u, 'Chinese titles give a Chinese page')
  assert.match(page, /Content-Security-Policy" content="default-src 'none'/u)

  const data = pageData(page)
  const three = await runtimeTag('three')
  assert.equal(page.split(three.slice(8, 4008)).length - 1, 0, 'the runtime is not inlined raw in the page')
  assert.deepEqual(Object.keys(data.runtimes), ['three'])
  assert.equal(data.runtimes.three, three)
  // Round trip: putting the runtime back gives exactly the game's own build.
  for (const [index, dir] of [flat, cube, cube2].entries()) {
    const game = data.games.find(entry => entry.title === before[index].html.match(/<title>(.*?)<\/title>/u)[1])
    assert.ok(game, dir)
    const restored = game.html.replace(/<!--dsh-runtime:([a-z0-9]+)-->/gu, (_all, id) => data.runtimes[id])
    assert.equal(restored, before[index].html)
  }
  assert.ok(result.bytes < before.reduce((sum, b) => sum + b.html.length, 0), 'smaller than the three builds side by side')

  // Exporting changed nothing in the projects: no rebuild, no new version.
  for (const [index, dir] of [flat, cube, cube2].entries()) {
    assert.equal((await stat(paths.artifact(dir))).mtimeMs, before[index].mtime)
    assert.equal((await listVersions(dir)).length, before[index].versions)
  }
})

test('chosen games keep their order; unknown folders are reported and paths outside the workspace refused', async (t) => {
  const root = await workspace(t)
  await makeGame(root, 'a', { title: 'Alpha' })
  await makeGame(root, 'b', { title: 'Beta' })
  const result = await exportWall({ root, projects: ['b', join(root, 'a'), 'nope'], name: 'For Friends!', lang: 'en' })
  assert.equal(result.file, join(root, 'export', 'for-friends.html'))
  const data = pageData(await readFile(result.file, 'utf8'))
  assert.deepEqual(data.games.map(game => game.title), ['Beta', 'Alpha'])
  assert.deepEqual(result.skipped.map(item => item.path), ['nope'])
  assert.equal(data.lang, 'en')
  await assert.rejects(exportWall({ root, projects: ['../elsewhere'] }), /inside the session working directory/u)
  await assert.rejects(exportWall({ root, projects: ['nope'] }), /No built games/u)
})

test('a title that would close the script element cannot break the page', async (t) => {
  const root = await workspace(t)
  const dir = await makeGame(root, 'evil', { title: 'Boss </script><script>alert(1)</script> <!-- \u2028 end' })
  void dir
  const page = await readFile((await exportWall({ root })).file, 'utf8')
  const data = pageData(page)
  assert.equal(data.games[0].title, 'Boss </script><script>alert(1)</script> <!-- \u2028 end')
  assert.equal(page.split('<script>alert(1)').length - 1, 0, 'the title never appears as markup')
})

test('the wall does not follow links out of the workspace, for folders or covers', async (t) => {
  const root = await workspace(t)
  const outside = await workspace(t)
  await makeGame(outside, 'secret', { title: 'Outside' })
  await symlink(join(outside, 'secret'), join(root, 'linked'))
  const own = await makeGame(root, 'own', { title: 'Own' })
  // A cover that is a link to a file elsewhere is not embedded.
  await writeFile(join(outside, 'private.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  await mkdir(join(own, '.studio'), { recursive: true })
  await symlink(join(outside, 'private.jpg'), join(own, '.studio', 'cover.jpg'))
  assert.deepEqual((await listGames(root)).games.map(game => game.title), ['Own'])
  const data = pageData(await readFile((await exportWall({ root })).file, 'utf8'))
  assert.deepEqual(data.games.map(game => game.title), ['Own'])
  assert.equal(data.games[0].cover, undefined)
})

test('covers are embedded small: PNG art is shrunk, screenshots kept as JPEG', async (t) => {
  const root = await workspace(t)
  const dir = await makeGame(root, 'g', { title: 'G' })
  const { PNG } = createRequire(import.meta.url)('pngjs')
  const big = new PNG({ width: 1024, height: 1024 })
  big.data.fill(200)
  await writeFile(join(dir, 'assets', 'hero.png'), PNG.sync.write(big))
  const manifest = JSON.parse(await readFile(join(dir, 'game.json'), 'utf8'))
  manifest.slots.hero.file = 'assets/hero.png'
  await writeFile(join(dir, 'game.json'), JSON.stringify(manifest))
  let data = pageData(await readFile((await exportWall({ root })).file, 'utf8'))
  const png = Buffer.from(data.games[0].cover.split(',')[1], 'base64')
  assert.equal(png.readUInt32BE(16), 480, 'shrunk to the tile width')

  await writeFile(join(dir, '.studio', 'cover.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  data = pageData(await readFile((await exportWall({ root })).file, 'utf8'))
  assert.match(data.games[0].cover, /^data:image\/jpeg;base64,/u)
})

test('the wall filters by 2D/3D and sorts by recent, versions or name', () => {
  const game = (title, dimension, versions, updatedAt) => ({ project: `/w/${title}`, title, dimension, versions, updatedAt, orientation: 'portrait', built: true, cover: undefined })
  const games = [game('企鹅', '3d', 15, '2026-11-04T10:00Z'), game('宝石', '2d', 9, '2026-11-04T12:00Z'), game('Apex', '2d', 6, '2026-11-03T12:00Z'), game('月光', undefined, 3, '2026-11-02T12:00Z')]
  assert.deepEqual(dimensionCounts(games), { all: 4, '2d': 2, '3d': 1 })
  assert.deepEqual(viewGames(games, 'all', 'recent').map(g => g.title), ['企鹅', '宝石', 'Apex', '月光'], 'recent keeps the scan order')
  assert.deepEqual(viewGames(games, '2d', 'recent').map(g => g.title), ['宝石', 'Apex'])
  assert.deepEqual(viewGames(games, '3d', 'recent').map(g => g.title), ['企鹅'])
  assert.deepEqual(viewGames(games, 'all', 'versions').map(g => g.versions), [15, 9, 6, 3])
  const byName = viewGames(games, 'all', 'name').map(g => g.title)
  assert.deepEqual(byName.filter(title => /\p{Script=Han}/u.test(title)), ['宝石', '企鹅', '月光'], 'Chinese titles in pinyin order')
  assert.equal(byName.length, 4)
  assert.deepEqual(games.map(g => g.title), ['企鹅', '宝石', 'Apex', '月光'], 'sorting never reorders the scan itself')
})

// ---------------------------------------------------------------- tools

test('game_studio_list and game_studio_export_wall answer from the working directory', async (t) => {
  const host = await import('../lib/index.js')
  const root = await workspace(t)
  const tools = new Map()
  const ctx = {
    effect(setup) { const dispose = setup(); t.after(() => dispose?.()) },
    tools: { register: (tool) => { tools.set(tool.name, tool) } },
    workingDirectory: { ensure: async () => root },
    get: () => undefined,
    inject() {},
  }
  host.apply(ctx, {})
  const exec = { agent: { id: 'session-1' }, callId: 'call-1', signal: new AbortController().signal }
  const call = (name, args) => tools.get(name).execute(args, exec)
  await call('game_studio_create', { path: 'games/penguin', title: '企鹅冰山', template: 'voxel' })
  await call('game_studio_create', { path: 'cat', title: 'Kitchen Cat' })

  const list = await call('game_studio_list', {})
  assert.deepEqual(list.games.map(g => [g.path, g.title, g.dimension, g.built]).sort(), [['cat', 'Kitchen Cat', '2d', true], ['games/penguin', '企鹅冰山', '3d', true]])
  assert.equal(list.note, undefined)

  const wall = await call('game_studio_export_wall', { games: '["cat"]', name: 'friends' })
  assert.equal(wall.file, join('export', 'friends.html'))
  assert.equal(wall.games, 1)
  await assert.rejects(call('game_studio_export_wall', { games: '{"cat": 1}' }), /JSON array/u)
  await assert.rejects(call('game_studio_export_wall', { games: '["../x"]' }), /inside the session working directory/u)
  // The export file and folder are not games, so the list does not change.
  assert.equal((await call('game_studio_list', {})).games.length, 2)
})

// ---------------------------------------------------------------- the page in a browser

test('the exported page plays a tile in place and Esc brings the wall back', { timeout: 120_000 }, async (t) => {
  const root = await workspace(t)
  await makeGame(root, 'moon', { title: 'Moon Garden' })
  await makeGame(root, 'isle', { title: 'Lantern Isle', template: 'voxel' })
  const { file } = await exportWall({ root })
  const { chromium } = createRequire(import.meta.url)('playwright-core')
  let browser
  try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }) }
  catch { try { browser = await chromium.launch({ channel: 'msedge', headless: true }) } catch { return t.skip('no Chrome or Edge here') } }
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`file://${file}`)
  assert.equal(await page.locator('.tile').count(), 2)
  assert.deepEqual(await page.locator('.chip').allTextContents(), ['All 2', '2D 1', '3D 1'])
  await page.locator('.chip', { hasText: '3D' }).click()
  assert.deepEqual(await page.locator('.tile .name').allTextContents(), ['Lantern Isle'])

  for (const filter of ['3D', '2D']) {
    await page.locator('.chip', { hasText: filter }).click()
    await page.locator('.tile').first().click()
    const frame = await (await page.waitForSelector('#player.open iframe')).contentFrame()
    await frame.waitForFunction('typeof window.__gameState === "function"', undefined, { timeout: 20_000 })
    assert.equal(await frame.evaluate('window.__gameState().phase'), 'title')
    await page.keyboard.press('Enter')
    await frame.waitForFunction('window.__gameState().phase === "playing"', undefined, { timeout: 10_000 })
    await page.keyboard.press('Escape')
    await page.waitForSelector('#player.open', { state: 'detached', timeout: 5000 }).catch(() => {})
    assert.equal(await page.locator('#player.open').count(), 0, `${filter}: Esc closes the game`)
    assert.equal(await page.locator('#player iframe').count(), 0, `${filter}: the closed game stops running`)
  }
  assert.deepEqual(errors, [])
})
