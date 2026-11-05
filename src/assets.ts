/**
 * Asset slots: generate candidates, check them, apply one into the game, and
 * step back to the previous version. Every applied asset keeps a ledger record
 * of where it came from and under which terms, and files changed inside the
 * project after they were recorded are noticed and recorded as edits.
 */
import { copyFile, readdir, readFile, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { buildProject, type BuildResult } from './build.ts'
import { findImage } from './providers/codex.ts'
import { checkSprite, decodePng, encodePng, fitSprite, jpegSize, shrinkToWidth, type SpriteChecks } from './png.ts'
import { openaiCost } from './pricing.ts'
import {
  loadLedger, loadManifest, paths, requireSlot, snapshotAsset, templateDir,
  type AssetLedger, type AssetRecord, type GameManifest, type SlotSpec,
} from './project.ts'
import type { ImageRequest, ImageResponse } from './providers/openai.ts'
import type { ReferenceImage } from './reference.ts'
import { shareInfo, type ShareInfo } from './share.ts'
import { listVersions } from './versions.ts'
import { compact, readJson, serialized, sha256, shortId, StudioError, writeFileAtomic, writeJson } from './util.ts'

export type ImageGenerator = (request: Omit<ImageRequest, 'apiKey' | 'baseUrl' | 'signal' | 'model'>) => Promise<ImageResponse & { provider: string }>

/** One image back from any provider, before it is checked and stored. */
export interface GeneratedImage {
  image: Uint8Array
  provider: string
  model: string
  usage: { inputTokens: number; outputTokens: number } | null
  /** The exact prompt of this image when it differs from the batch prompt (a variation). */
  fullPrompt?: string
  /** Number reserved for this candidate before it was requested; one is assigned when missing. */
  number?: number
  /** The reference picture this image followed. */
  reference?: { name: string; sha256: string }
  /** Tokens the provider's own agent spent on the run (Codex), when it reported them. */
  agentTokens?: number | null
  seconds?: number
}

/** A validated request for one slot, shared by every image generated for it. */
export interface Generation {
  slot: string
  spec: SlotSpec
  prompt: string
  fullPrompt: string
  size: string
  quality: string
}

export interface CandidateMeta {
  id: string
  /** Shown to the user as #1, #2, … in generation order; stable for the slot's lifetime. */
  number: number
  slot: string
  /** Preview-ready file in the candidates folder (fitted sprite or background). */
  file: string
  prompt: string
  fullPrompt: string
  provider: string
  model: string
  quality: string
  size: string
  createdAt: string
  checks: { pass: boolean; problems: string[]; width: number; height: number; sprite?: Omit<SpriteChecks, 'problems' | 'pass'> }
  usage: { inputTokens: number; outputTokens: number } | null
  agentTokens?: number | null
  seconds?: number
  reference?: { name: string; sha256: string }
}

const SPRITE_SIZE = '1024x1024'
const BACKGROUND_SIZE = '1536x1024'
const MAX_CANDIDATES_IN_STATE = 12
const MAX_JOBS_IN_STATE = 6
/** Opaque PNG backgrounds are shrunk to this width to keep exported games small. */
const BACKGROUND_MAX_WIDTH = 1024
/** Added to every prompt that comes with a reference picture. */
export const REFERENCE_HINT = 'Follow the attached reference image for the subject\'s design, proportions, colours and art style; '
  + 'keep the framing and background rules above.'
const EDITED_LICENSE = 'Changed inside this project (by hand or by the agent) after it was recorded; '
  + 'its terms follow the project and whatever it was based on.'

/** Per-candidate direction, so one batch offers real choices instead of near-copies. */
const VARIATIONS = {
  sprite: [
    'Take 1: simple, classic design with a calm pose.',
    'Take 2: livelier pose and slightly exaggerated, playful proportions.',
    'Take 3: richer surface detail and one distinctive accessory or marking.',
    'Take 4: bolder silhouette and stronger colour contrast.',
  ],
  scene: [
    'Take 1: sparse and calm, with large quiet areas.',
    'Take 2: small details spread evenly across the ground.',
    'Take 3: a few soft paths or clearings crossing the area.',
    'Take 4: gentle variation in ground texture and tone.',
  ],
}

export function composePrompt(manifest: GameManifest, slot: string, spec: SlotSpec, prompt: string): string {
  const style = manifest.style ? `Art style: ${manifest.style}. ` : ''
  if (spec.texture) {
    return `${style}Surface: ${prompt}. `
      + `A seamless, tileable ground texture for the 3D world of "${manifest.title}", seen straight from above with no perspective: `
      + 'even lighting, no shadows from objects, no objects standing on it, no characters, no text, no border, '
      + 'edges that wrap without visible seams, filling the whole frame.'
  }
  if (spec.transparent) {
    return `${style}Subject: ${prompt}. `
      + `A single game sprite for a top-down 2D arcade game (the ${spec.label.toLowerCase()} of "${manifest.title}"): `
      + 'exactly one subject, centered, whole body visible with empty margin on every side, facing the viewer, '
      + 'bold readable silhouette that stays clear when small, clean shading, no text, no frame, no ground, no cast shadow, '
      + 'isolated on a fully transparent background.'
  }
  return `${style}Scene: ${prompt}. `
    + `The ground of the play area for the top-down 2D arcade game "${manifest.title}", seen straight from above, `
    + 'evenly lit, calm low-contrast details so small characters stay readable on top of it, '
    + 'no characters, no creatures, no text, no UI, no border, no vignette, filling the whole frame.'
}

/** The prompt for candidate `index` of a batch of `count`. */
export function variantPrompt(generation: Generation, index: number, count: number): string {
  if (count <= 1) return generation.fullPrompt
  const takes = generation.spec.transparent ? VARIATIONS.sprite : VARIATIONS.scene
  return `${generation.fullPrompt} ${takes[index % takes.length]}`
}

export async function prepareGeneration(dir: string, slot: string, prompt: string, quality: string): Promise<Generation> {
  const manifest = await loadManifest(dir)
  const spec = requireSlot(manifest, slot)
  const text = prompt.trim()
  if (text.length === 0) throw new StudioError('Describe what the asset should look like', 'BAD_PROMPT')
  return {
    slot, spec, prompt: text, fullPrompt: composePrompt(manifest, slot, spec, text),
    size: spec.transparent ? SPRITE_SIZE : BACKGROUND_SIZE, quality,
  }
}

function isPng(data: Uint8Array): boolean {
  return data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
}

/** Check one generated image, fit it to its slot, and store it as the slot's next numbered candidate. */
export async function addCandidate(dir: string, generation: Generation, generated: GeneratedImage): Promise<CandidateMeta> {
  const { slot, spec } = generation
  const id = shortId()
  const folder = paths.candidates(dir, slot)
  const image = generated.image
  let file: string
  let checks: CandidateMeta['checks']
  if (spec.transparent) {
    await writeFileAtomic(join(folder, `${id}.raw${isPng(image) ? '.png' : '.bin'}`), image)
    if (!isPng(image)) {
      file = join(folder, `${id}.raw.bin`)
      checks = { pass: false, problems: ['not a PNG, so it cannot be transparent'], width: 0, height: 0 }
    } else {
      const raster = decodePng(image)
      const sprite = checkSprite(raster)
      file = join(folder, `${id}.png`)
      await writeFileAtomic(file, encodePng(fitSprite(raster, spec.size[0])))
      const { problems, pass, ...metrics } = sprite
      checks = { pass, problems, width: raster.width, height: raster.height, sprite: metrics }
    }
  } else if (isPng(image)) {
    const raster = shrinkToWidth(decodePng(image), BACKGROUND_MAX_WIDTH)
    file = join(folder, `${id}.png`)
    await writeFileAtomic(file, encodePng(raster))
    checks = { pass: true, problems: [], width: raster.width, height: raster.height }
  } else {
    file = join(folder, `${id}.jpg`)
    await writeFileAtomic(file, image)
    const dims = jpegSize(image)
    const problems = dims === undefined ? ['not a readable PNG or JPEG'] : []
    checks = { pass: problems.length === 0, problems, width: dims?.width ?? 0, height: dims?.height ?? 0 }
  }
  const number = generated.number ?? (await reserveNumbers(dir, slot, 1))[0]!
  const meta: CandidateMeta = {
      id, number, slot, file, prompt: generation.prompt, fullPrompt: generated.fullPrompt ?? generation.fullPrompt,
      provider: generated.provider, model: generated.model, quality: generation.quality, size: generation.size,
      createdAt: new Date().toISOString(), checks, usage: generated.usage,
      ...(generated.agentTokens !== undefined ? { agentTokens: generated.agentTokens } : {}),
    ...(generated.seconds !== undefined ? { seconds: generated.seconds } : {}),
    ...(generated.reference ? { reference: generated.reference } : {}),
  }
  await writeJson(join(folder, `${id}.json`), meta)
  return meta
}

/**
 * Reserve the next `count` candidate numbers of a slot, in request order, so
 * take 1 of a batch is the lowest number however the requests finish. A
 * counter file keeps two batches running at once from sharing numbers.
 */
export function reserveNumbers(dir: string, slot: string, count: number): Promise<number[]> {
  const counter = join(paths.candidates(dir, slot), '.next-number')
  return serialized(counter, async () => {
    let next: number
    try { next = Number(await readFile(counter, 'utf8')) } catch { next = NaN }
    if (!Number.isInteger(next) || next < 1) next = Math.max(0, ...(await listCandidates(dir, slot)).map(meta => meta.number)) + 1
    await writeFileAtomic(counter, String(next + count))
    return Array.from({ length: count }, (_, index) => next + index)
  })
}

/**
 * Generate `count` candidates, one request per candidate with its own
 * variation, all at once. Candidates that come back are kept even when others
 * fail; only a batch with no image at all is an error.
 */
export async function generateCandidates(
  dir: string, slot: string, prompt: string,
  options: { count: number; quality: ImageRequest['quality']; reference?: ReferenceImage }, generate: ImageGenerator,
): Promise<{ candidates: CandidateMeta[]; errors: string[] }> {
  const generation = await prepareGeneration(dir, slot, prompt, options.quality)
  const numbers = await reserveNumbers(dir, slot, options.count)
  const results = await Promise.allSettled(Array.from({ length: options.count }, async (_, index) => {
    const fullPrompt = variantPrompt(generation, index, options.count) + (options.reference ? ` ${REFERENCE_HINT}` : '')
    const response = await generate({
      prompt: fullPrompt, size: generation.size, n: 1, quality: options.quality,
      background: generation.spec.transparent ? 'transparent' : 'opaque',
      format: generation.spec.transparent ? 'png' : 'jpeg',
      ...(options.reference ? { reference: options.reference } : {}),
    })
    const image = response.images[0]
    if (image === undefined) throw new StudioError('The image service returned no image', 'PROVIDER')
    return addCandidate(dir, generation, {
      image, provider: response.provider, model: response.model, usage: response.usage, fullPrompt, number: numbers[index]!,
      ...(options.reference ? { reference: { name: options.reference.name, sha256: options.reference.sha256 } } : {}),
    })
  }))
  const candidates = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  await writeState(dir)
  const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason as unknown] : [])
  if (candidates.length === 0 && failures.length > 0) throw failures[0]
  return {
    candidates: candidates.sort((a, b) => a.number - b.number),
    errors: failures.map(error => error instanceof Error ? error.message : String(error)),
  }
}

/** Find a candidate by id or by its number (`3` or `#3`). */
async function readCandidate(dir: string, slot: string, ref: string): Promise<CandidateMeta> {
  const numbered = /^#?(\d+)$/u.exec(ref.trim())
  if (numbered) {
    const meta = (await listCandidates(dir, slot)).find(item => item.number === Number(numbered[1]))
    if (meta === undefined) throw new StudioError(`Slot "${slot}" has no candidate #${numbered[1]}`, 'BAD_CANDIDATE')
    return meta
  }
  if (!/^[a-z0-9-]+$/u.test(ref)) throw new StudioError(`Invalid candidate id "${ref}"`, 'BAD_CANDIDATE')
  try {
    const meta = await readJson<CandidateMeta>(join(paths.candidates(dir, slot), `${ref}.json`))
    return (await listCandidates(dir, slot)).find(item => item.id === meta.id) ?? meta
  } catch (error) {
    if (error instanceof StudioError && error.code === 'NOT_FOUND') throw new StudioError(`No candidate "${ref}" for slot "${slot}"`, 'BAD_CANDIDATE')
    throw error
  }
}

interface HistoryEntry { savedAt: string; file: string; spec: SlotSpec; record: AssetRecord | null }

/** Ledger and manifest changes for one project happen one at a time, so a scan never sees half an apply. */
function ledgerLock<T>(dir: string, task: () => Promise<T>): Promise<T> {
  return serialized(`${dir}\0ledger`, task)
}

/** Run a change to the project's files under the same lock as asset applies and ledger scans. */
export function withProjectLock<T>(dir: string, task: () => Promise<T>): Promise<T> {
  return ledgerLock(dir, task)
}

export async function applyCandidate(dir: string, slot: string, ref: string): Promise<{ record: AssetRecord; candidate: CandidateMeta; build: BuildResult }> {
  const applied = await ledgerLock(dir, () => applyNow(dir, slot, ref))
  const build = await buildProject(dir, `Applied ${applied.candidate.slot} #${applied.candidate.number}`)
  await writeState(dir, build)
  return { ...applied, build }
}

async function applyNow(dir: string, slot: string, ref: string): Promise<{ record: AssetRecord; candidate: CandidateMeta }> {
  await reconcileNow(dir)
  const manifest = await loadManifest(dir)
  const spec = requireSlot(manifest, slot)
  const candidate = await readCandidate(dir, slot, ref)
  if (!candidate.checks.pass) {
    throw new StudioError(`Candidate #${candidate.number} failed its checks (${candidate.checks.problems.join('; ')}); generate another one`, 'CHECKS_FAILED')
  }
  const ledger = await loadLedger(dir)
  await pushHistory(dir, slot, spec, ledger.assets[slot] ?? null, await readFile(join(dir, spec.file)))
  const file = `assets/${slot}-${candidate.id}${extname(candidate.file)}`
  await copyFile(candidate.file, join(dir, file))
  // A full picture covers the 2D play area; a texture keeps repeating across the 3D ground.
  manifest.slots[slot] = { ...spec, file, ...(spec.transparent || spec.texture ? {} : { tile: false }) }
  const record: AssetRecord = compact({
    slot, file, source: 'generated' as const, provider: candidate.provider, model: candidate.model,
    prompt: candidate.prompt, candidate: candidate.id, appliedAt: new Date().toISOString(),
    license: `Generated with ${candidate.provider} ${candidate.model}. Check that provider's terms before commercial use.`
      + (candidate.reference ? ` Follows the reference image "${candidate.reference.name}"; make sure you may use it.` : ''),
    sha256: await snapshotAsset(dir, file),
    ...(candidate.reference ? { reference: candidate.reference } : {}),
  })
  ledger.assets[slot] = record
  await writeJson(paths.manifest(dir), manifest)
  await writeJson(paths.ledger(dir), ledger)
  await removeIfUnused(dir, spec.file, manifest)
  return { record, candidate }
}

/** Save one version of a slot into history so it can be restored later. */
async function pushHistory(dir: string, slot: string, spec: SlotSpec, record: AssetRecord | null, content: Uint8Array): Promise<void> {
  const stamp = `${new Date().toISOString().replace(/[:.]/gu, '-')}-${shortId()}`
  const folder = paths.history(dir, slot)
  const saved = join(folder, `${stamp}-${basename(spec.file)}`)
  await writeFileAtomic(saved, content)
  const entry: HistoryEntry = { savedAt: new Date().toISOString(), file: saved, spec, record }
  await writeJson(join(folder, `${stamp}.json`), entry)
}

async function removeIfUnused(dir: string, file: string, manifest: GameManifest): Promise<void> {
  if (Object.values(manifest.slots).some(spec => spec.file === file)) return
  await rm(join(dir, file), { force: true })
}

async function historyEntries(dir: string, slot: string): Promise<string[]> {
  let names: string[]
  try { names = await readdir(paths.history(dir, slot)) } catch { return [] }
  return names.filter(name => name.endsWith('.json')).sort()
}

export async function revertSlot(dir: string, slot: string): Promise<{ restored: string; build: BuildResult }> {
  const restored = await ledgerLock(dir, () => revertNow(dir, slot))
  const build = await buildProject(dir, `Reverted ${slot}`)
  await writeState(dir, build)
  return { restored, build }
}

async function revertNow(dir: string, slot: string): Promise<string> {
  await reconcileNow(dir)
  const manifest = await loadManifest(dir)
  const current = requireSlot(manifest, slot)
  const entries = await historyEntries(dir, slot)
  const last = entries.at(-1)
  if (last === undefined) throw new StudioError(`Slot "${slot}" has no earlier version to go back to`, 'NO_HISTORY')
  const entryPath = join(paths.history(dir, slot), last)
  const entry = await readJson<HistoryEntry>(entryPath)
  const content = await readFile(entry.file)
  await writeFileAtomic(join(dir, entry.spec.file), content)
  manifest.slots[slot] = entry.spec
  const ledger = await loadLedger(dir)
  if (entry.record) ledger.assets[slot] = await restoredRecord(dir, manifest, slot, entry.record, entry.spec.file, content)
  else delete ledger.assets[slot]
  await writeJson(paths.manifest(dir), manifest)
  await writeJson(paths.ledger(dir), ledger)
  await removeIfUnused(dir, current.file, manifest)
  await rm(entry.file, { force: true })
  await rm(entryPath, { force: true })
  return entry.spec.file
}

/**
 * The record a restored version gets back. History saved before hashes
 * existed can hold an edited file under its original record; when the content
 * provably differs from what that record vouches for, say so.
 */
async function restoredRecord(
  dir: string, manifest: GameManifest, slot: string, record: AssetRecord, file: string, content: Uint8Array,
): Promise<AssetRecord> {
  const hash = await snapshotAsset(dir, file)
  if (record.sha256 !== undefined || record.source === 'edited') return { ...record, sha256: hash }
  const original = await recordedContent(dir, manifest, slot, record)
  if (original === undefined || sha256(original) === sha256(content)) return { ...record, sha256: hash }
  return {
    slot, file, source: 'edited', appliedAt: new Date().toISOString(), license: EDITED_LICENSE, sha256: hash,
    basedOn: { source: record.source, file: record.file, license: record.license },
  }
}

async function readIfExists(path: string): Promise<Uint8Array | undefined> {
  try { return await readFile(path) } catch { return undefined }
}

/** The content a ledger record vouches for, when the studio still has a copy of it. */
async function recordedContent(dir: string, manifest: GameManifest, slot: string, record: AssetRecord): Promise<Uint8Array | undefined> {
  if (record.sha256) {
    const snapshot = await readIfExists(join(paths.snapshots(dir), `${record.sha256}${extname(record.file)}`))
    if (snapshot) return snapshot
  }
  // Projects recorded before hashes existed: compare with the bundled original or the applied candidate.
  if (record.source === 'template') return readIfExists(join(templateDir(manifest.template), record.file))
  if (record.source === 'generated' && record.candidate) {
    return readIfExists(join(paths.candidates(dir, slot), `${record.candidate}${extname(record.file)}`))
  }
  return undefined
}

/**
 * Notice slot files that changed inside the project since they were recorded
 * (the agent or the user drew over them), record them as edits, and keep the
 * recorded version in history so the change can be reverted.
 * @returns the slots whose record changed.
 */
export function reconcileLedger(dir: string): Promise<string[]> {
  return ledgerLock(dir, () => reconcileNow(dir))
}

async function reconcileNow(dir: string): Promise<string[]> {
  const manifest = await loadManifest(dir)
  const ledger = await loadLedger(dir)
  const edited: string[] = []
  let dirty = false
  for (const [slot, spec] of Object.entries(manifest.slots)) {
    const content = await readIfExists(join(dir, spec.file))
    if (content === undefined) continue
    const hash = sha256(content)
    const record = ledger.assets[slot] ?? null
    if (record && record.file === spec.file) {
      if (record.sha256 === hash) continue
      const original = await recordedContent(dir, manifest, slot, record)
      if (record.sha256 === undefined && (original === undefined || sha256(original) === hash)) {
        // Unchanged (or unknowable) since it was recorded: start tracking it from here.
        ledger.assets[slot] = { ...record, sha256: await snapshotAsset(dir, spec.file) }
        dirty = true
        continue
      }
    }
    if (record) {
      const original = await recordedContent(dir, manifest, slot, record)
      if (original) await pushHistory(dir, slot, { ...spec, file: record.file }, record, original)
    }
    ledger.assets[slot] = {
      slot, file: spec.file, source: 'edited', appliedAt: new Date().toISOString(), license: EDITED_LICENSE,
      sha256: await snapshotAsset(dir, spec.file),
      ...(record ? { basedOn: { source: record.source, file: record.file, license: record.license } } : {}),
    }
    edited.push(slot)
    dirty = true
  }
  if (dirty) await writeJson(paths.ledger(dir), ledger)
  return edited
}

export interface StudioState {
  schema: 1
  project: string
  title: string
  orientation: 'portrait' | 'landscape'
  build: BuildResult | null
  slots: Record<string, {
    label: string
    file: string
    transparent: boolean
    record: AssetRecord | null
    history: number
    /** Newest candidates, in number order. */
    candidates: Array<Pick<CandidateMeta, 'id' | 'number' | 'file' | 'prompt' | 'createdAt' | 'model' | 'provider'> & { pass: boolean; problems: string[] }>
  }>
  /** Image generation so far in this project. */
  spend: { openaiImages: number; openaiUsd: number; codexImages: number; codexTokens: number }
  /** Saved versions of the whole game, newest first. */
  versions: Array<{ number: number; note: string; createdAt: string; buildId: string }>
  /** The open phone link, if any. */
  share: ShareInfo | null
  /** Recent generation runs, newest first, so the sidebar can show background work. */
  jobs: JobRecord[]
  updatedAt: string
}

/** A generation run that may outlive the tool call that started it. */
export interface JobRecord {
  id: string
  slot: string
  provider: string
  count: number
  done: number
  failed: number
  status: 'running' | 'completed' | 'failed' | 'killed' | 'interrupted'
  startedAt: string
  finishedAt?: string
  detail?: string
  /** Host process that runs it; a running record from another process was cut off by a restart. */
  hostPid: number
  /** Codex only: each run's folder and reserved number, so images finished before a restart can be picked up. */
  runs?: Array<{ run: string; number: number; fullPrompt: string; done?: boolean }>
  prompt?: string
  reference?: { name: string; sha256: string }
  /** Images picked up from runs a restart cut off. */
  recovered?: number
}

export async function writeJobRecord(dir: string, record: JobRecord): Promise<void> {
  await writeJson(join(paths.jobs(dir), `${record.id}.json`), record)
}

function hostAlive(pid: number): boolean {
  if (pid === process.pid) return true
  try { process.kill(pid, 0); return true } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM' }
}

/**
 * Codex runs cut off by a host restart may still have saved their picture
 * (Codex writes it before its turn ends). Turn those into candidates once, and
 * close the job record.
 */
async function recoverInterruptedRuns(dir: string): Promise<void> {
  let names: string[]
  try { names = await readdir(paths.jobs(dir)) } catch { return }
  for (const name of names.filter(entry => entry.endsWith('.json'))) {
    const record = await readJson<JobRecord>(join(paths.jobs(dir), name)).catch(() => undefined)
    if (record?.status !== 'running' || record.runs === undefined || record.prompt === undefined || hostAlive(record.hostPid)) continue
    let generation: Generation
    try { generation = await prepareGeneration(dir, record.slot, record.prompt, 'auto') } catch { continue }
    let recovered = 0
    for (const run of record.runs.filter(entry => entry.done !== true)) {
      const file = await findImage(paths.codexRun(dir, run.run)).catch(() => undefined)
      if (file === undefined) continue
      try {
        await addCandidate(dir, generation, {
          image: new Uint8Array(await readFile(file)), provider: 'codex', model: 'image_gen', usage: null,
          fullPrompt: run.fullPrompt, number: run.number, ...(record.reference ? { reference: record.reference } : {}),
        })
      } catch { continue }
      run.done = true
      recovered += 1
      await rm(paths.codexRun(dir, run.run), { recursive: true, force: true })
    }
    record.done += recovered
    record.failed = record.count - record.done
    record.recovered = recovered
    record.status = 'interrupted'
    record.finishedAt = new Date().toISOString()
    await writeJobRecord(dir, record)
  }
}

async function listJobs(dir: string): Promise<JobRecord[]> {
  let names: string[]
  try { names = await readdir(paths.jobs(dir)) } catch { return [] }
  const records = await Promise.all(names.filter(name => name.endsWith('.json'))
    .map(name => readJson<JobRecord>(join(paths.jobs(dir), name)).catch(() => undefined)))
  return records.filter((record): record is JobRecord => record !== undefined)
    .map(record => record.status === 'running' && record.hostPid !== process.pid ? { ...record, status: 'interrupted' as const } : record)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, MAX_JOBS_IN_STATE)
}

/** Every candidate of a slot in number order; candidates from before numbering get numbers by age. */
async function listCandidates(dir: string, slot: string): Promise<CandidateMeta[]> {
  let names: string[]
  try { names = await readdir(paths.candidates(dir, slot)) } catch { return [] }
  const metas = (await Promise.all(names.filter(name => name.endsWith('.json'))
    .map(name => readJson<CandidateMeta>(join(paths.candidates(dir, slot), name)).catch(() => undefined))))
    .filter((meta): meta is CandidateMeta => meta !== undefined)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return metas.map((meta, index) => ({ ...meta, number: meta.number ?? index + 1 }))
    .sort((a, b) => a.number - b.number)
}

/**
 * Snapshot the sidebar reads: current assets, candidates, spend, last build,
 * recent jobs. Writes for one project run one at a time, so background
 * candidates finishing together cannot overwrite each other's snapshot.
 */
export function writeState(dir: string, build?: BuildResult): Promise<StudioState> {
  return serialized(`${dir}\0state`, () => writeStateNow(dir, build))
}

async function writeStateNow(dir: string, build?: BuildResult): Promise<StudioState> {
  await reconcileLedger(dir)
  await recoverInterruptedRuns(dir)
  const manifest = await loadManifest(dir)
  const ledger: AssetLedger = await loadLedger(dir)
  let previous: StudioState | undefined
  try { previous = await readJson<StudioState>(paths.state(dir)) } catch { previous = undefined }
  const slots: StudioState['slots'] = {}
  const spend: StudioState['spend'] = { openaiImages: 0, openaiUsd: 0, codexImages: 0, codexTokens: 0 }
  for (const [slot, spec] of Object.entries(manifest.slots)) {
    const candidates = await listCandidates(dir, slot)
    for (const meta of candidates) {
      if (meta.provider === 'openai') {
        spend.openaiImages += 1
        spend.openaiUsd += openaiCost(meta.model, meta.usage) ?? 0
      } else if (meta.provider === 'codex') {
        spend.codexImages += 1
        spend.codexTokens += meta.agentTokens ?? 0
      }
    }
    slots[slot] = {
      label: spec.label, file: spec.file, transparent: spec.transparent,
      record: ledger.assets[slot] ?? null,
      history: (await historyEntries(dir, slot)).length,
      candidates: candidates.slice(-MAX_CANDIDATES_IN_STATE).map(meta => ({
        id: meta.id, number: meta.number, file: meta.file, prompt: meta.prompt, createdAt: meta.createdAt,
        model: meta.model, provider: meta.provider, pass: meta.checks.pass, problems: meta.checks.problems,
      })),
    }
  }
  spend.openaiUsd = Math.round(spend.openaiUsd * 10_000) / 10_000
  // A finished run's failure is old news once the slot has candidates from after it.
  const jobs = (await listJobs(dir)).filter(job => job.status === 'running'
    || !(slots[job.slot]?.candidates ?? []).some(meta => meta.createdAt > (job.finishedAt ?? job.startedAt)))
  const state: StudioState = {
    schema: 1, project: dir, title: manifest.title, orientation: manifest.orientation === 'landscape' ? 'landscape' : 'portrait',
    build: build ?? previous?.build ?? null,
    slots, spend, jobs,
    versions: (await listVersions(dir)).slice(0, 15).map(v => ({ number: v.number, note: v.note, createdAt: v.createdAt, buildId: v.buildId })),
    share: shareInfo(dir),
    updatedAt: new Date().toISOString(),
  }
  await writeJson(paths.state(dir), state)
  return state
}
