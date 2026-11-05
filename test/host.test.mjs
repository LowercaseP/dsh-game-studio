// The built Host plugin (lib/index.js) driven through its tools with a stand-in
// Harness context and a local fake of the OpenAI image endpoint, so the
// spend-approval gate, candidate numbering and wiring are checked as shipped.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PNG } from 'pngjs'

// The Harness supplies @deepseek-ai/dsh-tools; here defineTool only needs to hand the definition back.
const toolsStub = `data:text/javascript,${encodeURIComponent('export function defineTool(definition) { return definition }')}`
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-tools') return { url: toolsStub, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const host = await import('../lib/index.js')

function spritePng() {
  const image = new PNG({ width: 256, height: 256 })
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const inside = (x - 128) ** 2 + (y - 128) ** 2 <= 80 ** 2
      image.data.set([200, 90, 40, inside ? 255 : 0], (y * 256 + x) * 4)
    }
  }
  return PNG.sync.write(image).toString('base64')
}

/** Fake OpenAI image endpoint that records every request it is billed for. */
async function fakeOpenAI(t, { resets = 0 } = {}) {
  const requests = []
  const image = spritePng()
  let dropped = 0
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => { chunks.push(chunk) })
    req.on('end', () => {
      const raw = Buffer.concat(chunks)
      const type = req.headers['content-type'] ?? ''
      const body = type.includes('json') ? JSON.parse(raw.toString('utf8')) : {}
      // Multipart edits: pull the plain fields out of the form for the assertions.
      if (type.includes('multipart')) {
        for (const match of raw.toString('latin1').matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/gu)) body[match[1]] = match[2]
      }
      requests.push(Object.assign(body, { url: req.url, contentType: type, raw }))
      // A flaky proxy: the first `resets` requests lose their connection with no answer.
      if (dropped < resets) { dropped += 1; req.socket.destroy(); return }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ model: 'gpt-image-2.5-flare', data: [{ b64_json: image }], usage: { input_tokens: 240, output_tokens: 196 } }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests }
}

/** A minimal Harness context: tools, a working directory and the optional services the plugin injects. */
async function harness(t, { approval, config = {}, extra = {}, agent = {}, resets = 0 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'game-studio-host-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const openai = await fakeOpenAI(t, { resets })
  const tools = new Map()
  const services = {
    credentials: { resolve: async () => ({ value: 'sk-test-only', source: 'test' }) },
    ...(approval ? { approval } : {}),
    ...extra,
  }
  const ctx = {
    // cordis effects: run the setup, dispose when the test ends.
    effect(setup) { const dispose = setup(); t.after(() => dispose?.()) },
    tools: { register: (tool) => { tools.set(tool.name, tool) } },
    workingDirectory: { ensure: async () => root },
    get: (name) => services[name],
    inject(names, callback) {
      if (names.every(name => services[name] !== undefined)) callback({ ...services, effect() {} })
    },
  }
  host.apply(ctx, { openaiBaseUrl: openai.baseUrl, imageProvider: 'openai', ...config })
  const exec = { agent: { id: 'session-1', ...agent }, callId: 'call-1', signal: new AbortController().signal }
  const call = (name, args) => tools.get(name).execute(args, exec)
  await call('game_studio_create', { path: 'game', title: 'Moon Garden' })
  return { root, openai, call, tools }
}

function approvalAnswering(outcome) {
  const asked = []
  return { asked, request: async (request) => { asked.push(request); return outcome } }
}

test('a declined spend sends nothing to the image service', async (t) => {
  const approval = approvalAnswering('rejected')
  const { openai, call } = await harness(t, { approval })
  await assert.rejects(call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 3, quality: 'low' }), /declined/u)
  assert.equal(openai.requests.length, 0)
  assert.equal(approval.asked.length, 1)
  assert.match(approval.asked[0].displayReason.zh, /3 张「Hero」.*预计约 \$0\.02/u)
  assert.equal(approval.asked[0].toolName, 'game_studio_generate_asset')
})

test('with nobody to approve, generation fails closed unless the owner turned the prompt off', async (t) => {
  const closed = await harness(t)
  await assert.rejects(closed.call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1 }), /Nobody can approve/u)
  assert.equal(closed.openai.requests.length, 0)

  const open = await harness(t, { config: { confirmSpending: false } })
  const result = await open.call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1, quality: 'low' })
  assert.equal(result.candidates.length, 1)
  assert.equal(open.openai.requests.length, 1)
})

test('an approved batch makes one varied request per candidate, numbered in request order', async (t) => {
  const approval = approvalAnswering('allowed-once')
  const { root, openai, call } = await harness(t, { approval })
  const result = await call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 3, quality: 'low' })
  assert.deepEqual(result.candidates.map(item => item.number), [1, 2, 3])
  assert.equal(openai.requests.length, 3)
  assert.deepEqual(openai.requests.map(request => request.n), [1, 1, 1])
  const takes = openai.requests.map(request => /Take (\d)/u.exec(request.prompt)?.[1]).sort()
  assert.deepEqual(takes, ['1', '2', '3'], 'each candidate asks for a different take')
  assert.equal(result.costUsd, 0.0212)

  const second = await call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 2, quality: 'low' })
  assert.deepEqual(second.candidates.map(item => item.number), [4, 5], 'numbers continue across batches')

  const applied = await call('game_studio_apply_asset', { path: 'game', slot: 'hero', candidate: '#2' })
  assert.equal(applied.number, 2)
  const state = JSON.parse(await readFile(join(root, 'game', '.studio', 'state.json'), 'utf8'))
  assert.deepEqual(state.slots.hero.candidates.map(item => item.number), [1, 2, 3, 4, 5])
  assert.equal(state.spend.openaiImages, 5)
  assert.equal(state.spend.openaiUsd, 0.0354)
})

test('a reference image goes to the image-edit endpoint as a file, and the approval says so', async (t) => {
  const approval = approvalAnswering('allowed-once')
  const { root, openai, call } = await harness(t, { approval })
  const reference = Buffer.from(spritePng(), 'base64')
  await writeFile(join(root, 'my-fox.png'), reference)
  const result = await call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1, quality: 'low', reference: 'my-fox.png' })
  assert.equal(result.candidates.length, 1)
  const [request] = openai.requests
  assert.match(request.url, /\/images\/edits$/u)
  assert.match(request.contentType, /^multipart\/form-data/u)
  assert.ok(request.raw.includes(reference), 'the picture itself is uploaded')
  assert.match(request.raw.toString('latin1'), /filename="my-fox\.png"/u)
  assert.match(request.prompt, /Follow the attached reference image/u)
  assert.match(approval.asked[0].displayReason.zh, /参考图「my-fox\.png」/u)
  await assert.rejects(call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', reference: '/etc/hosts' }), /working directory or a chat attachment/u)
})

test('a dropped connection is retried once, and a second drop says so without blaming a missing proxy', async (t) => {
  const saved = Object.fromEntries(['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy'].map(name => [name, process.env[name]]))
  t.after(() => { for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value } })
  for (const name of Object.keys(saved)) delete process.env[name]

  const once = await harness(t, { approval: approvalAnswering('allowed-once'), resets: 1 })
  const result = await once.call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1, quality: 'low' })
  assert.equal(result.candidates.length, 1, 'the retry got the image')
  assert.equal(once.openai.requests.length, 2)

  const twice = await harness(t, { approval: approvalAnswering('allowed-once'), resets: 2 })
  await assert.rejects(twice.call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1, quality: 'low' }),
    (error) => /also on a second try/u.test(error.message) && /start DSH with HTTPS_PROXY set/u.test(error.message))
  assert.equal(twice.openai.requests.length, 2, 'only one retry')

  // With a proxy configured, the hint must not tell the user to configure one.
  process.env.HTTPS_PROXY = 'http://127.0.0.1:9'
  process.env.NO_PROXY = '127.0.0.1'
  const proxied = await harness(t, { approval: approvalAnswering('allowed-once'), resets: 2 })
  await assert.rejects(proxied.call('game_studio_generate_asset', { path: 'game', slot: 'hero', prompt: 'a fox', count: 1, quality: 'low' }),
    (error) => /through the proxy in HTTPS_PROXY/u.test(error.message) && !/start DSH with HTTPS_PROXY set/u.test(error.message))
})

test('the agent cannot open a phone link without the user\'s yes', async (t) => {
  const approval = approvalAnswering('rejected')
  const { root, call } = await harness(t, { approval })
  await assert.rejects(call('game_studio_share', { path: 'game', minutes: 10 }), /declined/u)
  assert.match(approval.asked[0].displayReason.zh, /局域网开放一个临时试玩链接 10 分钟/u)
  const state = JSON.parse(await readFile(join(root, 'game', '.studio', 'state.json'), 'utf8'))
  assert.equal(state.share, null)
})

// ---------------------------------------------------------------- playtest

/** Stand-ins for the Harness's attachment store and model catalog. */
function imageServices({ seesImages }) {
  const saved = []
  return {
    saved,
    extra: {
      attachments: {
        imageLimits: { maxImageBytes: 5_000_000, maxMessageImageBytes: 20_000_000 },
        saveImage: async ({ data, mediaType, name }) => {
          saved.push({ bytes: data.byteLength, mediaType, name })
          return { attachmentId: `att-${saved.length}`, mediaType, bytes: data.byteLength, width: 1, height: 1, name }
        },
      },
      llm: { resolveModelInfo: async () => ({ inputModalities: seesImages ? ['text', 'image'] : ['text'] }) },
    },
    agent: { session: { requestHeader: () => ({ config: { provider: 'deepseek', model: 'test-model' } }) } },
  }
}

const NO_BROWSER = /Chrome or Microsoft Edge/u

test('playtest plays the 3D game to its end screen with this-run-only rules and shows the model what it saw', { timeout: 180_000 }, async (t) => {
  const images = imageServices({ seesImages: true })
  const { root, call, tools } = await harness(t, images)
  await call('game_studio_create', { path: 'cube', title: 'Lantern Isle', template: 'voxel' })
  const before = {
    manifest: await readFile(join(root, 'cube', 'game.json'), 'utf8'),
    build: await readFile(join(root, 'cube', 'dist', 'index.html'), 'utf8'),
    versions: (await call('game_studio_versions', { path: 'cube' })).versions.length,
  }
  let result
  try { result = await call('game_studio_playtest', { path: 'cube', rules: '{"duration": 2}', portrait: false }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }

  assert.equal(result.finalPhase, 'won', result.summary)
  assert.equal(result.errors, 0, result.summary)
  assert.match(result.summary, /title@.*playing@.*won@/u)
  assert.match(result.summary, /rules for this run only: \{"duration":2\}/u)
  assert.doesNotMatch(result.summary, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')), 'paths are relative to the project')
  // The model gets the character close-ups first, then the screens.
  assert.deepEqual(result.images.map(image => image.name), ['characters', 'end', 'title'])
  const blocks = tools.get('game_studio_playtest').output.render({}, result)
  assert.equal(blocks.filter(block => block.type === 'image').length, 3)
  assert.equal(blocks[0].type, 'text')
  for (const slot of ['hero', 'enemy', 'pickup']) {
    const png = await readFile(join(root, 'cube', '.studio', 'renders', `${slot}.png`))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
  }
  // The "My games" shelf gets this run's picture as the cover (no midpoint in a 2-second round, so the title screen).
  const cover = await readFile(join(root, 'cube', '.studio', 'cover.jpg'))
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'the cover is a JPEG')
  const runTitle = result.summary.match(/\.studio\/playtest\/(run-[^/]+)\/title\.jpg/u)
  assert.ok(runTitle, result.summary)
  assert.deepEqual(cover, await readFile(join(root, 'cube', '.studio', 'playtest', runTitle[1], 'title.jpg')))

  // Reverse check: the override reached the game (without it, the round is still running) ...
  const plain = await call('game_studio_playtest', { path: 'cube', seconds: 2, portrait: false })
  assert.equal(plain.finalPhase, 'playing', plain.summary)
  // ... and neither run touched the project, its build or its versions.
  assert.equal(await readFile(join(root, 'cube', 'game.json'), 'utf8'), before.manifest)
  assert.equal(await readFile(join(root, 'cube', 'dist', 'index.html'), 'utf8'), before.build)
  assert.equal((await call('game_studio_versions', { path: 'cube' })).versions.length, before.versions)
})

test('playtest on a model that cannot see images returns text only and stores no attachments', { timeout: 120_000 }, async (t) => {
  const images = imageServices({ seesImages: false })
  const { call } = await harness(t, images)
  let result
  try { result = await call('game_studio_playtest', { path: 'game', rules: '{"duration": 2}' }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.equal(result.finalPhase, 'won', result.summary)
  assert.match(result.summary, /390×844 touch/u)
  assert.match(result.summary, /cannot view images/u)
  assert.deepEqual(result.images, [])
  assert.equal(images.saved.length, 0)
  assert.match(result.summary, /\.studio\/playtest\/run-[^/]+\/end\.jpg/u)
})

test('playtest refuses rules the game does not have, before starting a browser', async (t) => {
  const { call } = await harness(t)
  await assert.rejects(call('game_studio_playtest', { path: 'game', rules: '{"duraton": 2}' }), /Unknown rule duraton; this game's rules are: .*duration/u)
  await assert.rejects(call('game_studio_playtest', { path: 'game', rules: '[1]' }), /JSON object/u)
})

test('characters-only playtest returns one close-up per slot without playing: code-drawn characters from the game, the rest from their files', { timeout: 120_000 }, async (t) => {
  const images = imageServices({ seesImages: true })
  const { root, call, tools } = await harness(t, images)
  await call('game_studio_create', { path: 'cube', title: 'Lantern Isle', template: 'voxel' })
  let result
  try { result = await call('game_studio_playtest', { path: 'cube', characters: true }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.deepEqual(result.images.map(image => image.name), ['hero', 'enemy', 'pickup', 'background'])
  assert.match(result.summary, /^Character close-ups from the latest game code, drawn in .*: hero, enemy, pickup\./u)
  assert.match(result.summary, /Slot files, which the sidebar shows as they are: background\. Nothing else is needed/u)
  assert.doesNotMatch(result.summary, /Phases:/u, 'nothing was played')
  assert.equal(tools.get('game_studio_playtest').output.render({}, result).filter(block => block.type === 'image').length, 4)
  await assert.rejects(readFile(join(root, 'cube', '.studio', 'cover.jpg')), /ENOENT/u, 'close-ups alone are not a cover')
  const png = await readFile(join(root, 'cube', '.studio', 'renders', 'hero.png'))
  assert.equal(png.readUInt32BE(16), 384, 'close-ups for model work are drawn larger')

  assert.match(result.summary, /The sidebar already uses these as the thumbnails of hero, enemy, pickup; nothing else is needed/u)
  const code = join(root, 'cube', 'game.js')
  const original = await readFile(code, 'utf8')
  await writeFile(code, `${original}\n// lantern tweak\n`)
  const edited = await call('game_studio_playtest', { path: 'cube', characters: true })
  assert.match(edited.summary, /After game_studio_build the sidebar uses these/u, 'an edit not yet built is called out')

  // A 3D game without the hook gets the contract spelled out in the playtest result.
  await writeFile(code, original.replace('window.__renderSlots = renderSlots;', ''))
  const bare = await call('game_studio_playtest', { path: 'cube', seconds: 1 })
  assert.match(bare.summary, /No character close-ups, so the sidebar shows the template's icon files\. .*window\.__renderSlots\(size\) returns/u)

  // The 2D template draws its characters through drawCharacter(), so it has close-ups too.
  const flat = await call('game_studio_playtest', { path: 'game', characters: true })
  assert.deepEqual(flat.images.map(image => image.name), ['hero', 'enemy', 'pickup', 'background'])
  assert.match(flat.summary, /close-ups from the latest game code, drawn in .*: hero, enemy, pickup\./u)
  const flatHero = await readFile(join(root, 'game', '.studio', 'renders', 'hero.png'))
  assert.equal(flatHero.readUInt32BE(16), 384)

  // Characters redrawn into the slot files need no hook: show the files, no error.
  const flatCode = join(root, 'game', 'game.js')
  const flatOriginal = await readFile(flatCode, 'utf8')
  const unhooked = flatOriginal.replace('window.__renderSlots = renderSlots;', '')
  assert.notEqual(unhooked, flatOriginal)
  await writeFile(flatCode, unhooked)
  const templateFiles = await call('game_studio_playtest', { path: 'game', characters: true })
  assert.deepEqual(templateFiles.images.map(image => image.name), ['hero', 'enemy', 'pickup', 'background'])
  assert.match(templateFiles.summary, /Slot files, which the sidebar shows as they are: hero, enemy, pickup, background\. hero, enemy, pickup still hold the template's art; if game\.js draws those characters in code instead, draw them in drawCharacter\(\)/u)
  for (const slot of ['hero', 'enemy', 'pickup', 'background']) {
    const file = join(root, 'game', 'assets', `${slot}.svg`)
    await writeFile(file, (await readFile(file, 'utf8')).replace('</svg>', '<circle cx="10" cy="10" r="4" fill="#123456"/></svg>'))
  }
  await call('game_studio_build', { path: 'game', note: 'Redrew the characters' })
  const redrawn = await call('game_studio_playtest', { path: 'game', characters: true })
  assert.equal(redrawn.images.length, 4)
  assert.match(redrawn.summary, /Slot files, which the sidebar shows as they are: hero, enemy, pickup, background\. Nothing else is needed for them\./u)
  assert.doesNotMatch(redrawn.summary, /drawCharacter|still hold the template/u)
})

test('a clean playtest says the game is ready only once it is the user\'s game, and names a stale build', { timeout: 120_000 }, async (t) => {
  const { root, call } = await harness(t)
  let fresh
  try { fresh = await call('game_studio_playtest', { path: 'game', seconds: 2 }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.match(fresh.summary, /Errors: none/u)
  assert.doesNotMatch(fresh.summary, /All checks passed/u, 'the untouched template is not the user\'s game yet')
  const code = join(root, 'game', 'game.js')
  await writeFile(code, `${await readFile(code, 'utf8')}\n// the user's game\n`)
  const stale = await call('game_studio_playtest', { path: 'game', seconds: 2 })
  assert.match(stale.summary, /Checks passed, but the sidebar still plays an older build: call game_studio_build\./u)
  await call('game_studio_build', { path: 'game' })
  const ready = await call('game_studio_playtest', { path: 'game', seconds: 2 })
  assert.match(ready.summary, /All checks passed\. If the game already matches what the user asked for .* export it and tell the user\. More polish is optional/u)
  // A game that keeps playing but logs a script error is not ready.
  await writeFile(code, `${await readFile(code, 'utf8')}\nsetTimeout(function () { throw new Error('lantern boom') }, 300);\n`)
  await call('game_studio_build', { path: 'game' })
  const broken = await call('game_studio_playtest', { path: 'game', seconds: 2 })
  assert.match(broken.summary, /lantern boom/u)
  assert.match(broken.summary, /Phases: title.*playing/u)
  assert.doesNotMatch(broken.summary, /All checks passed/u)
})

test('create names the slots after the user\'s characters; generic names are pointed out at create and build', async (t) => {
  const { root, call, tools } = await harness(t)
  const named = await call('game_studio_create', {
    path: 'farm', title: '小鸡玉米农场', slots: '{"hero": "小鸡", "enemy": "狐狸", "pickup": "玉米粒", "background": "农场"}',
  })
  assert.deepEqual(named.slots, { hero: '小鸡', enemy: '狐狸', pickup: '玉米粒', background: '农场' })
  assert.match(named.note, /Read game\.json and game\.js before you edit them/u)
  assert.doesNotMatch(named.note, /generic names/u)
  const manifest = JSON.parse(await readFile(join(root, 'farm', 'game.json'), 'utf8'))
  assert.equal(manifest.slots.hero.label, '小鸡')
  assert.doesNotMatch(JSON.stringify(await call('game_studio_build', { path: 'farm' })), /generic names/u)

  const partly = await call('game_studio_create', { path: 'half', title: 'Half', slots: { hero: 'Chick' } })
  assert.match(partly.note, /still calls enemy, pickup, background by the template's generic names; set slots\.<slot>\.label in game\.json/u)
  assert.match((await call('game_studio_build', { path: 'half' })).note, /still calls enemy, pickup, background/u)
  await assert.rejects(call('game_studio_create', { path: 'bad', title: 'Bad', slots: '[1]' }), /slots must be a JSON object/u)
  // Agents pass the slots as an object as often as a string; the host must accept both.
  assert.equal(tools.get('game_studio_create').parameters.slots.type, 'json')
})

test('create gives a game its own art slots: new ones get a placeholder that builds, unneeded ones are dropped', { timeout: 120_000 }, async (t) => {
  const approval = approvalAnswering('rejected')
  const { root, call } = await harness(t, { approval })
  const cards = await call('game_studio_create', {
    path: 'cards', title: '史莱姆王讨伐战',
    slots: { hero: '流浪剑士', enemy: '史莱姆王', pickup: null, card: { label: '卡面', size: [256, 384] }, table: { label: '牌桌', transparent: false } },
  })
  assert.deepEqual(cards.slots, { hero: '流浪剑士', enemy: '史莱姆王', background: 'Background', card: '卡面', table: '牌桌' })
  const manifest = JSON.parse(await readFile(join(root, 'cards', 'game.json'), 'utf8'))
  assert.deepEqual(manifest.slots.card, { file: 'assets/card.svg', label: '卡面', size: [256, 384], transparent: true })
  assert.deepEqual(manifest.slots.table, { file: 'assets/table.svg', label: '牌桌', size: [512, 512], transparent: false })
  assert.equal(manifest.slots.pickup, undefined)
  await assert.rejects(readFile(join(root, 'cards', 'assets', 'pickup.svg')), /ENOENT/u, 'a dropped slot leaves no file behind')
  const placeholder = await readFile(join(root, 'cards', 'assets', 'card.svg'), 'utf8')
  assert.match(placeholder, /^<svg [^>]*width="256" height="384"/u)
  assert.match(placeholder, />卡<\/text>/u)
  const ledger = JSON.parse(await readFile(join(root, 'cards', 'assets', 'ASSETS.json'), 'utf8'))
  assert.equal(ledger.assets.card.source, 'template')
  assert.equal(ledger.assets.pickup, undefined)
  const html = await readFile(join(root, 'cards', 'dist', 'index.html'), 'utf8')
  assert.match(html, /"card":"data:image\/svg\+xml;base64,/u, 'the new slot reaches game.js as GAME.assets.card')
  // AI art can be made for a slot the game added, named the way the sidebar names it.
  await assert.rejects(call('game_studio_generate_asset', { path: 'cards', slot: 'card', prompt: 'a sword card', count: 1, quality: 'low' }), /declined/u)
  assert.match(approval.asked.at(-1).displayReason.zh, /「卡面」/u)
  // Close-ups skip the dropped slot and show the new ones from their files.
  let close
  try { close = await call('game_studio_playtest', { path: 'cards', characters: true }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.match(close.summary, /Character close-ups from the latest game code, drawn in .*: hero, enemy\./u)
  assert.match(close.summary, /Slot files, which the sidebar shows as they are: background, card, table\./u)
  assert.doesNotMatch(close.summary, /pickup/u)

  await assert.rejects(call('game_studio_create', { path: 'b1', title: 'B', slots: { 'Big Card': 'x' } }), /must be letters, digits or _ and start with a letter/u)
  // camelCase is how agents name things in JS; names that differ only in case would share a file on macOS.
  const camel = await call('game_studio_create', { path: 'camel', title: 'C', slots: { cardArt: { label: '卡面' } } })
  assert.equal(camel.slots.cardArt, '卡面')
  await assert.rejects(call('game_studio_create', { path: 'b5', title: 'B', slots: { card: 'a', Card: 'b' } }), /differ only in case/u)
  // A refused request leaves no half-made folder, so the same call works once it is fixed.
  await assert.rejects(call('game_studio_create', { path: 'retry', title: 'R', slots: { hero: 'x', 'Bad Name': {} } }), /must be letters, digits or _/u)
  await assert.rejects(readFile(join(root, 'retry', 'game.json')), /ENOENT/u)
  await call('game_studio_create', { path: 'retry', title: 'R', slots: { hero: 'x' } })
  // A template slot can be redrawn to another shape, e.g. a full portrait background instead of a tile.
  const court = await call('game_studio_create', { path: 'court', title: 'C', slots: { background: { label: '球场', size: [390, 844], transparent: false } } })
  assert.equal(court.slots.background, '球场')
  const courtManifest = JSON.parse(await readFile(join(root, 'court', 'game.json'), 'utf8'))
  assert.deepEqual(courtManifest.slots.background, { file: 'assets/background.svg', label: '球场', size: [390, 844], transparent: false })
  assert.match(await readFile(join(root, 'court', 'assets', 'background.svg'), 'utf8'), /^<svg [^>]*width="390" height="844"/u)
  await assert.rejects(call('game_studio_create', { path: 'b3', title: 'B', slots: { card: { size: [10, 10] } } }), /between 32 and 2048/u)
  await assert.rejects(call('game_studio_create', { path: 'b4', title: 'B', slots: { hero: null, enemy: null, pickup: null, background: null } }), /at least one asset slot/u)
})

/** Width × height of a baseline or progressive JPEG. */
function jpegSize(data) {
  for (let i = 2; i < data.length - 9;) {
    if (data[i] !== 0xff) { i++; continue }
    const marker = data[i + 1]
    if (marker === 0xc0 || marker === 0xc2) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)]
    i += 2 + data.readUInt16BE(i + 2)
  }
  return null
}

test('a landscape game is played and previewed landscape; phone screenshots are sharp enough to read', { timeout: 120_000 }, async (t) => {
  const { root, call } = await harness(t)
  const wide = await call('game_studio_create', { path: 'runner', title: 'Fox Run', orientation: 'landscape' })
  assert.equal(wide.orientation, 'landscape')
  assert.equal(JSON.parse(await readFile(join(root, 'runner', 'game.json'), 'utf8')).orientation, 'landscape')
  assert.equal(JSON.parse(await readFile(join(root, 'runner', '.studio', 'state.json'), 'utf8')).orientation, 'landscape')
  assert.equal(JSON.parse(await readFile(join(root, 'game', '.studio', 'state.json'), 'utf8')).orientation, 'portrait')
  await assert.rejects(call('game_studio_create', { path: 'sideways', title: 'S', orientation: 'sideways' }), /Unknown orientation "sideways"/u)

  let played
  try { played = await call('game_studio_playtest', { path: 'runner', seconds: 1 }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.match(played.summary, /^Playtest in .*, 960×540;/u, 'a landscape game plays landscape without being asked')
  const wideShot = played.summary.match(/Screenshots: .*?(\S+title\.jpg)/u)[1]
  assert.deepEqual(jpegSize(await readFile(join(root, 'runner', wideShot))), [960, 540])
  const upright = await call('game_studio_playtest', { path: 'runner', seconds: 1, portrait: true })
  assert.match(upright.summary, /^Playtest in .*, 390×844 touch, screenshots at 2× pixels/u, 'the call can still ask for portrait')

  const phone = await call('game_studio_playtest', { path: 'game', seconds: 1 })
  assert.match(phone.summary, /^Playtest in .*, 390×844 touch, screenshots at 2× pixels/u)
  const phoneShot = phone.summary.match(/Screenshots: .*?(\S+title\.jpg)/u)[1]
  assert.deepEqual(jpegSize(await readFile(join(root, 'game', phoneShot))), [780, 1688])
})

test('a game that defines window.__autoplay plays its own round in the playtest; others are told to add it', { timeout: 120_000 }, async (t) => {
  const { root, call } = await harness(t)
  const code = join(root, 'game', 'game.js')
  const original = await readFile(code, 'utf8')
  let arrows
  try { arrows = await call('game_studio_playtest', { path: 'game', seconds: 2, rules: '{"maxPickups": 0}' }) }
  catch (error) { if (NO_BROWSER.test(error.message)) return t.skip('no Chrome or Edge here'); throw error }
  assert.match(arrows.summary, /played by arrow keys toward the nearest pickup/u)
  assert.match(arrows.summary, /The arrow-key autopilot scored nothing\. .*define window\.__autoplay\(state\)/u)

  // The game's own bot scores without the hero moving: arrow keys are not pressed.
  const bot = original.replace("  window.__gameState = function () {", "  window.__autoplay = function (state) { if (state.phase === 'playing') score += 1; };\n  window.__gameState = function () {")
  assert.notEqual(bot, original)
  await writeFile(code, bot)
  await call('game_studio_build', { path: 'game' })
  const self = await call('game_studio_playtest', { path: 'game', seconds: 2, rules: '{"maxPickups": 0}' })
  assert.match(self.summary, /played by the game's own window\.__autoplay/u)
  assert.match(self.summary, /Best score: [1-9]\d*/u)
  assert.doesNotMatch(self.summary, /autopilot scored nothing/u)

  await writeFile(code, original.replace("  window.__gameState = function () {", "  window.__autoplay = function () { throw new Error('bot tripped'); };\n  window.__gameState = function () {"))
  await call('game_studio_build', { path: 'game' })
  const broken = await call('game_studio_playtest', { path: 'game', seconds: 2 })
  assert.equal((broken.summary.match(/window\.__autoplay failed: .*bot tripped/gu) ?? []).length, 1, 'a broken bot is reported once, not every tick')

  // An invented autoplay rule is pointed at the hook.
  await assert.rejects(call('game_studio_playtest', { path: 'game', rules: '{"autoDemo": true}' }), /Unknown rule autoDemo; .*define window\.__autoplay\(state\) in game\.js instead of a rule/u)
  await assert.rejects(call('game_studio_playtest', { path: 'game', rules: '{"duraton": 2}' }), /^(?![\s\S]*__autoplay)[\s\S]*Unknown rule duraton/u)
})

test('the agent is told how sidebar thumbnails of code-drawn characters work, so it never reads the plugin', async (t) => {
  const { tools } = await harness(t)
  for (const name of ['game_studio_create', 'game_studio_build']) {
    const description = tools.get(name).description
    assert.match(description, /window\.__renderSlots\(size\) returns \{ <slot>: "data:image\/png;base64,…" \}/u, name)
    assert.match(description, /type: "renders"/u, name)
  }
  assert.match(tools.get('game_studio_playtest').description, /characters: true/u)
  for (const name of ['game_studio_create', 'game_studio_playtest']) {
    const description = tools.get(name).description
    assert.match(description, /window\.__gameState\(\), which must return \{ phase: "title" \| "playing" \| "won" \| "lost", score, hearts, fps, hero: \{ x, y \}, pickups: \[\{ x, y \}\], enemies: \[\{ x, y \}\], world: \{ w, h \} \}/u, name)
    assert.match(description, /Keep this function when you rewrite game\.js/u, name)
  }
  assert.match(tools.get('game_studio_create').description, /drawCharacter\(g, slot, size\)/u)
  for (const name of ['game_studio_create', 'game_studio_playtest']) {
    assert.match(tools.get(name).description, /should also define window\.__autoplay\(state\): during a playtest it is called about 10 times a second/u, name)
  }
  for (const name of ['game_studio_create', 'game_studio_build']) {
    assert.match(tools.get(name).description, /overwriting its file in assets\/ .*records it as your edit, so leave assets\/ASSETS\.json alone/u, name)
  }
  assert.match(tools.get('game_studio_create').description, /rules are free-form: add any key and read it in game\.js as window\.GAME\.rules\.<key>/u)
})
