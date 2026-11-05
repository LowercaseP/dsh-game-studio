// Project, build and asset-slot flow against the real template, with a fake
// image generator standing in for the paid provider.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { applyCandidate, composePrompt, generateCandidates, reserveNumbers, revertSlot, withProjectLock, writeState } from '../src/assets.ts'
import { buildProject } from '../src/build.ts'
import { checkSprite, decodePng, fitSprite } from '../src/png.ts'
import { estimateOpenaiCost } from '../src/pricing.ts'
import { createProject, loadLedger, loadManifest, paths, templateDir } from '../src/project.ts'
import { askToSpend, spendNotice } from '../src/spend.ts'
import { loadReference } from '../src/reference.ts'
import { startShare, stopShare } from '../src/share.ts'
import { listVersions, restoreFiles } from '../src/versions.ts'
import { mkdir, symlink } from 'node:fs/promises'
import { resolveInside, writeJson } from '../src/util.ts'

/** A size×size PNG with an opaque disc of the given radius, transparent elsewhere (or fully opaque). */
function discPng(size, radius, { opaqueBackground = false, cx = size / 2, cy = size / 2 } = {}) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
      png.data[i] = inside ? 220 : 255
      png.data[i + 1] = inside ? 80 : 255
      png.data[i + 2] = inside ? 40 : 255
      png.data[i + 3] = inside || opaqueBackground ? 255 : 0
    }
  }
  return new Uint8Array(PNG.sync.write(png))
}

/** One image per request, handed out in request order. */
function fakeGenerator(images) {
  const calls = []
  const generate = async (request) => {
    calls.push(request)
    return { images: [images[(calls.length - 1) % images.length]], model: 'fake-image-1', provider: 'fake', usage: { inputTokens: 10, outputTokens: 20 } }
  }
  return { generate, calls }
}

async function tempProject(t) {
  const root = await mkdtemp(join(tmpdir(), 'game-studio-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'my-game')
  await createProject(dir, { title: 'Moon Garden', style: 'watercolor storybook' })
  return { root, dir }
}

test('sprite checks accept a cut-out and reject an opaque or edge-touching image', () => {
  const ok = checkSprite(decodePng(discPng(200, 60)))
  assert.equal(ok.pass, true, ok.problems.join())
  const opaque = checkSprite(decodePng(discPng(200, 60, { opaqueBackground: true })))
  assert.equal(opaque.pass, false)
  assert.match(opaque.problems.join(), /transparency/u)
  const clipped = checkSprite(decodePng(discPng(200, 80, { cx: 20 })))
  assert.equal(clipped.pass, false)
  assert.match(clipped.problems.join(), /edge/u)
})

test('fitSprite crops to the subject and centres it with padding', () => {
  const fitted = fitSprite(decodePng(discPng(400, 50, { cx: 100, cy: 300 })), 128)
  assert.equal(fitted.width, 128)
  const checks = checkSprite(fitted)
  assert.equal(checks.pass, true, checks.problems.join())
  assert.ok(Math.abs(checks.bbox.x + checks.bbox.w / 2 - 64) <= 1)
  assert.ok(checks.bbox.w >= 110 && checks.bbox.w <= 116, `width ${checks.bbox.w}`)
})

test('create and build produce one self-contained HTML file with a no-network CSP', async (t) => {
  const { dir } = await tempProject(t)
  const manifest = await loadManifest(dir)
  assert.equal(manifest.title, 'Moon Garden')
  assert.equal(manifest.style, 'watercolor storybook')
  const ledger = await loadLedger(dir)
  assert.deepEqual(Object.keys(ledger.assets).sort(), Object.keys(manifest.slots).sort())
  const build = await buildProject(dir)
  const html = await readFile(build.artifact, 'utf8')
  assert.match(html, /Content-Security-Policy/u)
  assert.match(html, /connect-src 'none'/u)
  assert.match(html, /window\.GAME=/u)
  assert.doesNotMatch(html, /src="https?:|href="https?:/u)
  // Exactly the two inline scripts we emit; nothing in the payload closed one early.
  assert.equal(html.match(/<\/script>/gu).length, 2)
  for (const slot of Object.keys(manifest.slots)) assert.match(html, new RegExp(`"${slot}":"data:image/`, 'u'))
})

test('a "</script>" inside game code or the title cannot break out of the inline script', async (t) => {
  const { dir } = await tempProject(t)
  const manifest = await loadManifest(dir)
  manifest.title = 'Evil </script><img src=x onerror=alert(1)>'
  await writeFile(join(dir, 'game.json'), JSON.stringify(manifest))
  await writeFile(join(dir, 'game.js'), 'var s = "</script><script>alert(1)</script>"; <!-- x\n')
  const build = await buildProject(dir)
  const html = await readFile(build.artifact, 'utf8')
  assert.equal(html.match(/<\/script>/giu).length, 2)
  assert.doesNotMatch(html, /<title>[^<]*<img/u)
})

test('a project refuses to be created over an existing game or outside the workspace', async (t) => {
  const { root, dir } = await tempProject(t)
  await assert.rejects(createProject(dir, { title: 'Again' }), /already exists/u)
  assert.throws(() => resolveInside(root, '../elsewhere'), /inside the session working directory/u)
})

test('generate → apply → revert keeps the game buildable and the ledger honest', async (t) => {
  const { dir } = await tempProject(t)
  const before = await loadManifest(dir)
  const { generate, calls } = fakeGenerator([discPng(1024, 300), discPng(1024, 300, { opaqueBackground: true })])
  const { candidates } = await generateCandidates(dir, 'hero', 'a fox in a red scarf', { count: 2, quality: 'low' }, generate)
  assert.equal(calls.length, 2, 'one request per candidate')
  assert.equal(calls[0].n, 1)
  assert.equal(calls[0].background, 'transparent')
  assert.match(calls[0].prompt, /watercolor storybook/u)
  assert.match(calls[0].prompt, /a fox in a red scarf/u)
  assert.notEqual(calls[0].prompt, calls[1].prompt, 'each candidate is a different take')
  assert.equal(candidates.length, 2)
  assert.deepEqual(candidates.map(item => item.number), [1, 2])
  assert.equal(candidates[0].checks.pass, true)
  assert.equal(candidates[1].checks.pass, false)

  await assert.rejects(applyCandidate(dir, 'hero', candidates[1].id), /failed its checks/u)
  const { record, build } = await applyCandidate(dir, 'hero', candidates[0].id)
  assert.equal(record.source, 'generated')
  assert.equal(record.prompt, 'a fox in a red scarf')
  const afterApply = await loadManifest(dir)
  assert.equal(afterApply.slots.hero.file, `assets/hero-${candidates[0].id}.png`)
  await stat(join(dir, afterApply.slots.hero.file))
  assert.match(await readFile(build.artifact, 'utf8'), /"hero":"data:image\/png;base64,/u)
  await assert.rejects(stat(join(dir, before.slots.hero.file)), 'the replaced file moves into history')

  const reverted = await revertSlot(dir, 'hero')
  assert.equal(reverted.restored, before.slots.hero.file)
  const afterRevert = await loadManifest(dir)
  assert.deepEqual(afterRevert.slots.hero, before.slots.hero)
  assert.equal((await loadLedger(dir)).assets.hero.source, 'template')
  await assert.rejects(stat(join(dir, afterApply.slots.hero.file)), 'the reverted file is removed')
  await assert.rejects(revertSlot(dir, 'hero'), /no earlier version/u)
})

test('background slots request an opaque JPEG and switch the slot to cover mode', async (t) => {
  const { dir } = await tempProject(t)
  // Minimal JPEG header with a 1536x1024 SOF0 marker is enough for the size check.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x00, 0x06, 0x00, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9])
  const { generate, calls } = fakeGenerator([jpeg])
  const { candidates: [candidate] } = await generateCandidates(dir, 'background', 'moonlit garden path', { count: 1, quality: 'low' }, generate)
  assert.equal(calls[0].background, 'opaque')
  assert.equal(calls[0].format, 'jpeg')
  assert.equal(candidate.checks.pass, true, candidate.checks.problems.join())
  assert.equal(candidate.checks.width, 1536)
  await applyCandidate(dir, 'background', candidate.id)
  const manifest = await loadManifest(dir)
  assert.equal(manifest.slots.background.tile, false)
  assert.match(manifest.slots.background.file, /\.jpg$/u)
})

test('a slot file drawn over inside the project is recorded as an edit and can be reverted', async (t) => {
  const { dir } = await tempProject(t)
  const template = await readFile(join(templateDir('collector'), 'assets', 'hero.svg'))
  await writeFile(join(dir, 'assets', 'hero.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>')
  const state = await writeState(dir)
  const ledger = await loadLedger(dir)
  assert.equal(ledger.assets.hero.source, 'edited')
  assert.equal(ledger.assets.hero.basedOn.source, 'template')
  assert.match(ledger.assets.hero.license, /Changed inside this project/u)
  assert.equal(ledger.assets.enemy.source, 'template', 'untouched slots keep their record')
  assert.equal(state.slots.hero.history, 1, 'the recorded version went into history')

  await revertSlot(dir, 'hero')
  assert.deepEqual(await readFile(join(dir, 'assets', 'hero.svg')), template)
  assert.equal((await loadLedger(dir)).assets.hero.source, 'template')
})

test('projects recorded before hashes: untouched files keep their record, edited ones are caught', async (t) => {
  const { dir } = await tempProject(t)
  const ledger = await loadLedger(dir)
  for (const record of Object.values(ledger.assets)) delete record.sha256
  await writeJson(paths.ledger(dir), ledger)
  await writeFile(join(dir, 'assets', 'enemy.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  await writeState(dir)
  const after = await loadLedger(dir)
  assert.equal(after.assets.hero.source, 'template')
  assert.match(after.assets.hero.sha256, /^[0-9a-f]{64}$/u, 'tracking starts from here')
  assert.equal(after.assets.enemy.source, 'edited')
})

test('a version saved under the wrong record before hashes existed comes back labelled as an edit', async (t) => {
  const { dir } = await tempProject(t)
  const manifest = await loadManifest(dir)
  const { sha256: _hash, ...oldRecord } = (await loadLedger(dir)).assets.hero
  const folder = paths.history(dir, 'hero')
  const saved = join(folder, '0001-hero.svg')
  await writeJson(join(folder, '0001.json'), { savedAt: new Date().toISOString(), file: saved, spec: manifest.slots.hero, record: oldRecord })
  await writeFile(saved, '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>')
  await revertSlot(dir, 'hero')
  const record = (await loadLedger(dir)).assets.hero
  assert.equal(record.source, 'edited')
  assert.equal(record.basedOn.source, 'template')
})

test('two batches reserving numbers at once never share one', async (t) => {
  const { dir } = await tempProject(t)
  const [a, b] = await Promise.all([reserveNumbers(dir, 'hero', 3), reserveNumbers(dir, 'hero', 2)])
  assert.deepEqual([...a, ...b].sort((x, y) => x - y), [1, 2, 3, 4, 5])
})

test('spend notices give the service, count and estimate; anything but a yes stops the spend', async () => {
  assert.ok(Math.abs(estimateOpenaiCost('gpt-image-2.5-flare', 'low', false, 1) - 0.00708) < 1e-9)
  assert.equal(estimateOpenaiCost('gpt-image-2.5-flare', 'high', false, 1), null, 'no made-up price for unmeasured quality')
  // Measured 2026-11-03: one low image with a reference cost 1,185 input + 196 output tokens.
  assert.ok(Math.abs(estimateOpenaiCost('gpt-image-2.5-flare', 'low', false, 1, true) - 0.01460) < 1e-9)
  const withReference = spendNotice({ provider: 'openai', model: 'gpt-image-2.5-flare', label: 'Hero', wide: false, count: 1, quality: 'low', reference: 'fox.png' })
  assert.match(withReference.zh, /预计约 \$0\.01/u)
  const high = spendNotice({ provider: 'openai', model: 'gpt-image-2.5-flare', label: 'Hero', wide: false, count: 2, quality: 'high' })
  assert.match(high.zh, /还没有估价/u)
  const codex = spendNotice({ provider: 'codex', model: '', label: 'Enemy', wide: false, count: 1, quality: 'auto' })
  assert.match(codex.en, /Codex plan/u)
  const exec = { agent: { id: 's' }, signal: new AbortController().signal }
  const answer = (outcome) => ({ request: async () => outcome })
  await askToSpend(answer('allowed-once'), exec, 'tool', high)
  await assert.rejects(askToSpend(answer('rejected'), exec, 'tool', high), /declined/u)
  await assert.rejects(askToSpend(answer('unavailable'), exec, 'tool', high), /Nobody could approve/u)
  await assert.rejects(askToSpend(answer('cancelled'), exec, 'tool', high), /cancelled/u)
  await assert.rejects(askToSpend(undefined, exec, 'tool', high), /Nobody can approve/u)
})

test('a game that asks for the three runtime gets it inlined ahead of its code; unknown runtimes are refused', async (t) => {
  const { dir } = await tempProject(t)
  const manifest = await loadManifest(dir)
  await writeJson(paths.manifest(dir), { ...manifest, runtime: ['three'] })
  const html = await readFile((await buildProject(dir)).artifact, 'utf8')
  const vendor = html.indexOf('three.js 0.187.0')
  assert.ok(vendor > 0, 'three is inlined')
  assert.ok(vendor < html.indexOf('window.GAME='), 'before the game data and code')
  assert.doesNotMatch(html, /<script[^>]+src=/u, 'still one self-contained file')
  await writeJson(paths.manifest(dir), { ...manifest, runtime: ['unity'] })
  await assert.rejects(buildProject(dir), /Unknown runtime "unity"/u)
})

test('the build tells the game which slots hold the user\'s own art', async (t) => {
  const { dir } = await tempProject(t)
  const read = async () => JSON.parse(/window\.GAME=(\{.*?\});<\/script>/u.exec(await readFile((await buildProject(dir)).artifact, 'utf8'))[1])
  assert.equal((await read()).slots.hero.custom, false)
  await writeFile(join(dir, 'assets', 'hero.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  await writeState(dir)
  const game = await read()
  assert.equal(game.slots.hero.custom, true, 'an edited file counts as custom art')
  assert.equal(game.slots.enemy.custom, false)
})

test('texture slots ask for seamless ground and keep repeating after apply', async (t) => {
  const { dir } = await tempProject(t)
  const manifest = await loadManifest(dir)
  manifest.slots.background = { ...manifest.slots.background, tile: true, texture: true }
  await writeJson(paths.manifest(dir), manifest)
  assert.match(composePrompt(manifest, 'background', manifest.slots.background, 'mossy stones'), /seamless, tileable ground texture/u)
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x00, 0x06, 0x00, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9])
  const { candidates: [candidate] } = await generateCandidates(dir, 'background', 'mossy stones', { count: 1, quality: 'low' }, fakeGenerator([jpeg]).generate)
  await applyCandidate(dir, 'background', candidate.id)
  assert.equal((await loadManifest(dir)).slots.background.tile, true)
})

test('the voxel template makes a 3D game: three.js inlined, ground as a repeating texture, voxel models by default', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'game-studio-voxel-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'isle')
  const manifest = await createProject(dir, { title: 'Lantern Isle', template: 'voxel' })
  assert.deepEqual(manifest.runtime, ['three'])
  assert.equal(manifest.slots.background.texture, true)
  const html = await readFile((await buildProject(dir)).artifact, 'utf8')
  assert.ok(html.indexOf('three.js 0.187.0') < html.indexOf('window.GAME='))
  const game = JSON.parse(/window\.GAME=(\{.*?\});<\/script>/u.exec(html)[1])
  assert.deepEqual(Object.values(game.slots).map(slot => slot.custom), [false, false, false, false])
  assert.match(html, /heroMode/u)
})

test('every build that changes the game is a version, and going back is itself undoable', async (t) => {
  const { dir } = await tempProject(t)
  await buildProject(dir, 'Created')
  await buildProject(dir, 'Nothing changed')
  assert.deepEqual((await listVersions(dir)).map(v => v.note), ['Created'], 'an identical build adds no version')

  const manifest = await loadManifest(dir)
  await writeJson(paths.manifest(dir), { ...manifest, rules: { ...manifest.rules, hearts: 5 } })
  await buildProject(dir, 'Five hearts')
  const { candidates: [candidate] } = await generateCandidates(dir, 'hero', 'a fox', { count: 1, quality: 'low' }, fakeGenerator([discPng(1024, 300)]).generate)
  const applied = await applyCandidate(dir, 'hero', candidate.id)
  assert.deepEqual((await listVersions(dir)).map(v => v.note), ['Applied hero #1', 'Five hearts', 'Created'])

  await withProjectLock(dir, () => restoreFiles(dir, 1))
  await buildProject(dir, 'Back to version 1')
  const back = await loadManifest(dir)
  assert.equal(back.rules.hearts, manifest.rules.hearts)
  assert.equal(back.slots.hero.file, 'assets/hero.svg')
  await assert.rejects(stat(join(dir, applied.record.file)), 'files the old version did not have are removed')
  assert.equal((await loadLedger(dir)).assets.hero.source, 'template', 'the ledger travels with the version')

  await withProjectLock(dir, () => restoreFiles(dir, 3))
  await buildProject(dir, 'Back to version 3')
  assert.equal((await loadManifest(dir)).slots.hero.file, applied.record.file)
  await stat(join(dir, applied.record.file))
  assert.deepEqual((await listVersions(dir)).map(v => v.number).slice(0, 2), [5, 4])
  await assert.rejects(withProjectLock(dir, () => restoreFiles(dir, 99)), /no version 99/u)
})

test('reference images come only from the workspace or chat attachments, and must be pictures', async (t) => {
  const { root, dir } = await tempProject(t)
  const png = discPng(64, 20)
  await writeFile(join(dir, 'ref.png'), png)
  const ok = await loadReference(dir, 'ref.png')
  assert.equal(ok.mime, 'image/png')
  assert.equal(ok.name, 'ref.png')

  const outside = await mkdtemp(join(tmpdir(), 'game-studio-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(join(outside, 'secret.png'), png)
  await assert.rejects(loadReference(dir, join(outside, 'secret.png')), /working directory or a chat attachment/u)
  await symlink(join(outside, 'secret.png'), join(dir, 'link.png'))
  await assert.rejects(loadReference(dir, 'link.png'), /working directory or a chat attachment/u, 'a symlink cannot reach outside')

  // The Harness stores chat attachments by content hash, so the file name means nothing to the user.
  const home = join(root, 'dsh-home')
  const hash = 'd839bd29c7f7062772e3aa41565737f729ef4d25ae304d6ea9cdce30e445cd97'
  await mkdir(join(home, 'attachments', 'v1', 'objects', 'd8'), { recursive: true })
  await writeFile(join(home, 'attachments', 'v1', 'objects', 'd8', hash), png)
  process.env.DSH_HOME = home
  t.after(() => { delete process.env.DSH_HOME })
  const attached = await loadReference(dir, join(home, 'attachments', 'v1', 'objects', 'd8', hash))
  assert.equal(attached.name, 'chat-attachment.png')
  assert.equal(attached.fromChat, true)
  assert.equal(ok.fromChat, undefined)
  const notice = spendNotice({ provider: 'openai', model: 'gpt-image-2.5-flare', label: 'Fox', wide: false, count: 1, quality: 'low', reference: attached.name, referenceFromChat: true })
  assert.match(notice.zh, /按你在聊天里附上的图来画/u)
  assert.match(notice.en, /the image you attached in chat/u)
  assert.doesNotMatch(notice.zh + notice.en, /chat-attachment|d839bd/u)

  await writeFile(join(dir, 'notes.png'), 'not really a picture')
  await assert.rejects(loadReference(dir, 'notes.png'), /PNG, JPEG or WebP/u)
})

test('a phone link serves only the latest build behind its token and stops when asked', async (t) => {
  const { dir } = await tempProject(t)
  await assert.rejects(startShare(dir, 5, '127.0.0.1'), /Build the game before sharing/u)
  await buildProject(dir)
  const info = await startShare(dir, 5, '127.0.0.1')
  t.after(() => stopShare(dir))
  assert.match(info.qrSvg, /^<svg/u)
  const page = await fetch(info.url)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /<title>Moon Garden<\/title>/u)
  const base = new URL(info.url)
  assert.equal((await fetch(`${base.origin}/wrong-token/`)).status, 404)
  assert.equal((await fetch(`${base.origin}/`)).status, 404)
  assert.equal((await fetch(`${base.origin}${base.pathname.slice(0, -1)}`, { redirect: 'manual' })).status, 302)
  assert.equal(stopShare(dir), true)
  await assert.rejects(fetch(info.url), 'closed after stop')
})
