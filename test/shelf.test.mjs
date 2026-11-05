// The "My games" shelf scan, over a real folder tree read the way the sidebar
// reads the workspace (directory listings and file reads, nothing else).
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { findGameDirs, pickCover, scanShelf } from '../src/client/shelf.ts'

function workspaceReader() {
  const lists = []
  const list = async (path) => {
    lists.push(path)
    const entries = await readdir(path, { withFileTypes: true })
    return { entries: entries.map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' })), truncated: false }
  }
  const read = async (path) => readFile(path, 'utf8')
  return { list, read, lists }
}

async function put(root, path, content = '') {
  await mkdir(join(root, path, '..'), { recursive: true })
  await writeFile(join(root, path), content)
}

async function game(root, dir, { title, template = 'collector', state, slots } = {}) {
  await put(root, `${dir}/game.json`, JSON.stringify({ schema: 1, template, title: title ?? dir, slots: slots ?? { hero: { file: 'assets/hero.svg' } } }))
  await mkdir(join(root, dir, '.studio'), { recursive: true })
  if (state) await put(root, `${dir}/.studio/state.json`, JSON.stringify(state))
}

async function tempRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'shelf-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

const signal = new AbortController().signal

test('the shelf finds game projects two levels deep, newest first, and skips everything else', async (t) => {
  const root = await tempRoot(t)
  await game(root, 'penguin', { title: '企鹅冰山寻鱼记', template: 'voxel', state: {
    title: '企鹅冰山寻鱼记', orientation: 'landscape', build: { buildId: 'b1' }, updatedAt: '2026-11-04T10:00:00.000Z',
    versions: [{ number: 3, createdAt: '2026-11-04T09:00:00.000Z' }, { number: 2 }, { number: 1 }],
  } })
  await game(root, 'games/fox', { title: 'Moonlit Fox', state: { build: null, updatedAt: '2026-11-05T08:00:00.000Z', versions: [] } })
  await game(root, 'fresh') // created, never built, no state yet
  // Not games, or not places a game is looked for:
  await game(root, 'a/b/too-deep')
  await game(root, 'node_modules/pkg')
  await game(root, '.hidden/game')
  await put(root, 'manifest-only/game.json', '{}')
  await put(root, 'notes/readme.md', 'hi')

  const { list, read } = workspaceReader()
  const scan = await scanShelf(list, read, root, signal)
  assert.equal(scan.partial, false)
  assert.deepEqual(scan.games.map(g => g.project), [join(root, 'games/fox'), join(root, 'penguin'), join(root, 'fresh')])

  const [fox, penguin, fresh] = scan.games
  assert.equal(fox.title, 'Moonlit Fox')
  assert.equal(fox.dimension, '2d')
  assert.equal(fox.built, false)
  assert.equal(penguin.dimension, '3d')
  assert.equal(penguin.orientation, 'landscape')
  assert.equal(penguin.built, true)
  assert.equal(penguin.versions, 3)
  assert.equal(fresh.title, 'fresh')
  assert.equal(fresh.updatedAt, '')
  assert.equal(fresh.cover, join(root, 'fresh', 'assets/hero.svg'), 'without screenshots the hero art is the cover')
})

test('the shelf does not search inside a game project or past its listing budget', async (t) => {
  const root = await tempRoot(t)
  await game(root, 'outer')
  await game(root, 'outer/inner')
  for (let i = 0; i < 6; i++) await mkdir(join(root, `empty-${i}`, 'sub'), { recursive: true })

  const { list, lists } = workspaceReader()
  const all = await findGameDirs(list, root, signal)
  assert.deepEqual(all.dirs, [join(root, 'outer')])
  assert.ok(!lists.includes(join(root, 'outer/inner')), 'a project folder is not searched for more projects')

  const capped = await findGameDirs(workspaceReader().list, root, signal, { maxLists: 3 })
  assert.equal(capped.partial, true, 'running out of listings is reported, not hidden')
  // Reverse check: the same tree with enough budget is complete.
  assert.equal((await findGameDirs(workspaceReader().list, root, signal, { maxLists: 100 })).partial, false)
})

test('the cover is the saved cover, else the newest playtest\'s mid-game shot, else the hero art', async (t) => {
  const root = await tempRoot(t)
  const { list } = workspaceReader()
  const manifest = { slots: { enemy: { file: 'assets/enemy.png' }, hero: { file: 'assets/hero.png' } } }
  await game(root, 'g', { slots: manifest.slots })
  const dir = join(root, 'g')
  assert.equal(await pickCover(list, dir, manifest, signal), join(dir, 'assets/hero.png'))

  await put(root, 'g/.studio/playtest/run-2026-11-03/mid.jpg')
  await put(root, 'g/.studio/playtest/run-2026-11-04/title.jpg')
  await put(root, 'g/.studio/playtest/run-2026-11-04/end.jpg')
  assert.equal(await pickCover(list, dir, manifest, signal), join(dir, '.studio/playtest/run-2026-11-04/title.jpg'), 'newest run first, mid > title > end within it')

  await put(root, 'g/.studio/cover.jpg')
  assert.equal(await pickCover(list, dir, manifest, signal), join(dir, '.studio/cover.jpg'))

  // A slot file that would leave the project, or is not a picture, is never read.
  await game(root, 'h', { slots: { hero: { file: '../secret.png' } } })
  assert.equal(await pickCover(list, join(root, 'h'), { slots: { hero: { file: '../secret.png' } } }, signal), undefined)
  assert.equal(await pickCover(list, join(root, 'h'), { slots: { hero: { file: 'assets/hero.txt' } } }, signal), undefined)
})

test('an unreadable folder or a broken state file leaves the rest of the shelf intact', async (t) => {
  const root = await tempRoot(t)
  await game(root, 'ok', { state: { updatedAt: '2026-11-05T00:00:00.000Z', versions: [] } })
  await game(root, 'broken')
  await put(root, 'broken/.studio/state.json', '{not json')
  await mkdir(join(root, 'locked'))
  const { list: base, read } = workspaceReader()
  const list = async (path, s) => { if (path.endsWith('locked')) throw new Error('outside-workspace'); return base(path, s) }
  const scan = await scanShelf(list, read, root, signal)
  assert.deepEqual(scan.games.map(g => g.title), ['ok', 'broken'])
})
