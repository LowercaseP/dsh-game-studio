// Codex provider and background batch runs, against a fake `codex` executable
// that copies a prepared image into its working folder the way Codex does.
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { prepareGeneration, writeJobRecord, writeState } from '../src/assets.ts'
import { runCodexBatch } from '../src/generation.ts'
import { createProject, paths } from '../src/project.ts'
import { codexArgs, resolveCodex } from '../src/providers/codex.ts'

function png(width, height, { transparent }) {
  const image = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const inside = (x - width / 2) ** 2 + (y - height / 2) ** 2 <= (Math.min(width, height) / 3) ** 2
      image.data.set([90, 160, 90, inside || !transparent ? 255 : 0], i)
    }
  }
  return PNG.sync.write(image)
}

// Modes: copy (image.png), rename (fox.png), fail (no image, exit 1), hang (until killed),
// save-hang (saves image.png, then hangs until killed).
const FAKE_CODEX = `#!${process.execPath}
const { appendFileSync, copyFileSync } = require('node:fs')
const { join } = require('node:path')
const args = process.argv.slice(2)
const dir = args[args.indexOf('-C') + 1]
appendFileSync(process.env.FAKE_CODEX_CALLS, JSON.stringify(args) + '\\n')
const mode = process.env.FAKE_CODEX_MODE
if (mode === 'hang') setTimeout(() => {}, 60000)
else if (mode === 'save-hang') { copyFileSync(process.env.FAKE_CODEX_IMAGE, join(dir, 'image.png')); setTimeout(() => {}, 60000) }
else if (mode === 'fail') { console.error('error: not logged in to Codex'); process.exit(1) }
else {
  copyFileSync(process.env.FAKE_CODEX_IMAGE, join(dir, mode === 'rename' ? 'fox.png' : 'image.png'))
  // Like Codex under the Harness's FORCE_COLOR=1: styled output breaks naive parsing.
  const bold = (text) => process.env.FORCE_COLOR ? '\\u001b[1m' + text + '\\u001b[0m' : text
  console.error('codex\\nSaved.\\n' + bold('tokens used') + '\\n' + bold('1,234'))
}
`

async function setup(t, { mode = 'copy', image = png(64, 64, { transparent: true }) } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'game-studio-codex-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  // Extensionless and outside any package, so Node runs the fake as CommonJS.
  const command = join(root, 'codex')
  await writeFile(command, FAKE_CODEX)
  await chmod(command, 0o755)
  const calls = join(root, 'calls.jsonl')
  await writeFile(calls, '')
  const imageFile = join(root, 'source.png')
  await writeFile(imageFile, image)
  process.env.FAKE_CODEX_MODE = mode
  process.env.FAKE_CODEX_CALLS = calls
  process.env.FAKE_CODEX_IMAGE = imageFile
  const dir = join(root, 'game')
  await createProject(dir, { title: 'Moon Garden', style: 'watercolor' })
  const readCalls = async () => (await readFile(calls, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  return { root, dir, command, readCalls }
}

const batch = (command, count) => ({ command, count, effort: 'low', timeoutMs: 60_000 })

test('codex runs non-interactively, sandboxed to its own folder, asking the image tool for transparency', () => {
  const args = codexArgs({ workDir: '/tmp/run-1', prompt: 'a fox', transparent: true, effort: 'low', model: 'gpt-x' })
  assert.deepEqual(args.slice(0, 8), ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', '/tmp/run-1', '-c', 'approval_policy="never"'])
  assert.ok(args.includes('model_reasoning_effort="low"'))
  assert.equal(args[args.indexOf('-m') + 1], 'gpt-x')
  const prompt = args.at(-1)
  assert.match(prompt, /^\$imagegen /u)
  assert.match(prompt, /genuinely transparent background/u)
  assert.match(prompt, /Image: a fox/u)
  assert.match(codexArgs({ workDir: '/tmp/r', prompt: 'grass', transparent: false }).at(-1), /opaque image that fills the whole frame/u)
  // The effort value is spliced into a config string, so only known values pass.
  assert.throws(() => codexArgs({ workDir: '/tmp/r', prompt: 'x', transparent: true, effort: 'low" -c sandbox="danger-full-access' }), /Unknown Codex reasoning effort/u)
})

test('a codex batch stores every finished image as a checked candidate and records the job', async (t) => {
  const { dir, command, readCalls } = await setup(t)
  process.env.FORCE_COLOR = '1'
  t.after(() => { delete process.env.FORCE_COLOR })
  const generation = await prepareGeneration(dir, 'hero', 'a fox with a lantern', 'auto')
  const progress = []
  const result = await runCodexBatch(dir, generation, batch(command, 2), 'game-studio-test1', new AbortController().signal, line => progress.push(line))
  assert.equal(result.status, 'completed')
  assert.equal(result.candidates.length, 2)
  for (const candidate of result.candidates) {
    assert.equal(candidate.provider, 'codex')
    assert.equal(candidate.checks.pass, true, candidate.checks.problems.join('; '))
    assert.equal(candidate.agentTokens, 1234)
    await stat(candidate.file)
  }
  const calls = await readCalls()
  assert.equal(calls.length, 2)
  assert.notEqual(calls[0][calls[0].indexOf('-C') + 1], calls[1][calls[1].indexOf('-C') + 1], 'each image runs in its own folder')
  assert.deepEqual(progress, ['0/2', '1/2', '2/2'])
  const state = JSON.parse(await readFile(paths.state(dir), 'utf8'))
  assert.equal(state.jobs[0].status, 'completed')
  assert.equal(state.jobs[0].done, 2)
  assert.equal(state.slots.hero.candidates.length, 2)
  // Successful run folders are cleaned up.
  assert.deepEqual(await readdir(join(paths.studio(dir), 'codex')), [])
})

test('an image saved under another name is still found', async (t) => {
  const { dir, command } = await setup(t, { mode: 'rename' })
  const generation = await prepareGeneration(dir, 'enemy', 'a bramble', 'auto')
  const result = await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test2', new AbortController().signal)
  assert.equal(result.status, 'completed')
})

test('a run that saves no image fails with Codex\'s own message and keeps its log', async (t) => {
  const { dir, command } = await setup(t, { mode: 'fail' })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  const result = await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test3', new AbortController().signal)
  assert.equal(result.status, 'failed')
  assert.equal(result.candidates.length, 0)
  assert.match(result.errors[0], /without saving an image.*not logged in/u)
  const log = await readFile(join(paths.codexRun(dir, 'game-studio-test3-1'), 'codex.log'), 'utf8')
  assert.match(log, /not logged in/u)
  const state = JSON.parse(await readFile(paths.state(dir), 'utf8'))
  assert.equal(state.jobs[0].status, 'failed')
  assert.match(state.jobs[0].detail, /not logged in/u)
})

test('cancelling a batch stops the Codex process and records the job as killed', async (t) => {
  const { dir, command } = await setup(t, { mode: 'hang' })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  const controller = new AbortController()
  const started = Date.now()
  setTimeout(() => { controller.abort() }, 300)
  const result = await runCodexBatch(dir, generation, batch(command, 2), 'game-studio-test4', controller.signal)
  assert.equal(result.status, 'killed')
  assert.ok(Date.now() - started < 10_000, 'the hanging process was killed')
  assert.match(result.errors[0], /cancelled/u)
})

test('a picture Codex already saved is kept when the run is stopped before Codex finishes', async (t) => {
  const { dir, command } = await setup(t, { mode: 'save-hang' })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  const controller = new AbortController()
  setTimeout(() => { controller.abort() }, 500)
  const result = await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test5', controller.signal)
  assert.equal(result.status, 'killed')
  assert.equal(result.candidates.length, 1)
  assert.equal(result.candidates[0].checks.pass, true)
})

test('pictures finished by runs a host restart cut off become candidates, once', async (t) => {
  const { dir } = await setup(t)
  const generation = await prepareGeneration(dir, 'enemy', 'a seal', 'auto')
  const dead = 2 ** 22 + 7 // no such process
  const runs = [{ run: 'game-studio-old-1', number: 3, fullPrompt: 'seal, take 1' }, { run: 'game-studio-old-2', number: 4, fullPrompt: 'seal, take 2' }]
  await writeJobRecord(dir, {
    id: 'game-studio-old', slot: 'enemy', provider: 'codex', count: 2, done: 0, failed: 0,
    status: 'running', startedAt: new Date().toISOString(), hostPid: dead, prompt: generation.prompt, runs,
  })
  await mkdir(paths.codexRun(dir, 'game-studio-old-1'), { recursive: true })
  await writeFile(join(paths.codexRun(dir, 'game-studio-old-1'), 'image.png'), png(64, 64, { transparent: true }))
  const state = await writeState(dir)
  assert.deepEqual(state.slots.enemy.candidates.map(meta => meta.number), [3])
  assert.equal(state.slots.enemy.candidates[0].provider, 'codex')
  const job = state.jobs.find(entry => entry.id === 'game-studio-old')
  assert.equal(job?.status, 'interrupted')
  assert.equal(job?.recovered, 1)
  assert.equal(job?.done, 1)
  const again = await writeState(dir)
  assert.equal(again.slots.enemy.candidates.length, 1, 'recovered only once')

  // A job whose host is still alive is someone else's live run and is left alone.
  await writeJobRecord(dir, {
    id: 'game-studio-live', slot: 'hero', provider: 'codex', count: 1, done: 0, failed: 0,
    status: 'running', startedAt: new Date().toISOString(), hostPid: process.ppid, prompt: 'a fox', runs: [{ run: 'game-studio-live-1', number: 1, fullPrompt: 'a fox' }],
  })
  await mkdir(paths.codexRun(dir, 'game-studio-live-1'), { recursive: true })
  await writeFile(join(paths.codexRun(dir, 'game-studio-live-1'), 'image.png'), png(64, 64, { transparent: true }))
  assert.equal((await writeState(dir)).slots.hero.candidates.length, 0)
})

test('a finished run\'s failure stops showing once the slot has newer candidates', async (t) => {
  const { dir, command } = await setup(t, { mode: 'fail' })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test6', new AbortController().signal)
  assert.equal((await writeState(dir)).jobs[0]?.status, 'failed')
  process.env.FAKE_CODEX_MODE = 'copy'
  await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test7', new AbortController().signal)
  const state = await writeState(dir)
  assert.deepEqual(state.jobs.map(job => job.id), ['game-studio-test7'])
})

test('a wide opaque PNG background is shrunk for the game and passes', async (t) => {
  const { dir, command } = await setup(t, { image: png(2048, 1024, { transparent: false }) })
  const generation = await prepareGeneration(dir, 'background', 'moonlit grass', 'auto')
  const result = await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test5', new AbortController().signal)
  const [candidate] = result.candidates
  assert.equal(candidate.checks.pass, true)
  assert.equal(candidate.checks.width, 1024)
  assert.equal(candidate.checks.height, 512)
  assert.match(candidate.file, /\.png$/u)
})

test('a transparent slot rejects an image without real transparency', async (t) => {
  const { dir, command } = await setup(t, { image: png(64, 64, { transparent: false }) })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  const result = await runCodexBatch(dir, generation, batch(command, 1), 'game-studio-test6', new AbortController().signal)
  assert.equal(result.candidates[0].checks.pass, false)
})

test('a job left running by an earlier host process shows as interrupted', async (t) => {
  const { dir } = await setup(t)
  await writeJobRecord(dir, {
    id: 'game-studio-old', slot: 'hero', provider: 'codex', count: 2, done: 0, failed: 0,
    status: 'running', startedAt: new Date().toISOString(), hostPid: process.pid + 100_000,
  })
  const state = await writeState(dir)
  assert.equal(state.jobs[0].status, 'interrupted')
})

test('a configured codex path must exist', async (t) => {
  const { command } = await setup(t)
  assert.equal(await resolveCodex(command), command)
  await assert.rejects(resolveCodex('/nowhere/codex'), /Codex CLI not found at \/nowhere\/codex/u)
})

test('a reference picture is handed to Codex as an input and is never taken for its answer', async (t) => {
  const { dir, command, readCalls } = await setup(t, { mode: 'fail' })
  const generation = await prepareGeneration(dir, 'hero', 'a fox', 'auto')
  const reference = { data: png(64, 64, { transparent: true }), mime: 'image/png', name: 'my-fox.png', sha256: 'x' }
  const result = await runCodexBatch(dir, generation, { ...batch(command, 1), reference }, 'game-studio-ref1', new AbortController().signal)
  assert.equal(result.status, 'failed', 'the reference.png Codex was given must not count as a generated image')
  const [args] = await readCalls()
  assert.match(args.at(-1), /Reference: \.\/reference\.png is an input picture/u)
  await stat(join(paths.codexRun(dir, 'game-studio-ref1-1'), 'reference.png'))
})
