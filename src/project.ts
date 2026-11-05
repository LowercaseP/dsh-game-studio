/**
 * A game project is an ordinary folder in the session workspace:
 *
 *   game.json            manifest: title, art style, asset slots, rules
 *   game.js              the game (classic script, edited by the agent)
 *   assets/              current art, one file per slot
 *   assets/ASSETS.json   where every current asset came from
 *   .studio/             candidates, replaced versions, snapshots, preview state
 *   dist/index.html      single-file build used for preview and export
 */
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, sha256, StudioError, writeFileAtomic, writeJson } from './util.ts'

export const TEMPLATES = ['collector', 'voxel'] as const
export const TEMPLATE_LICENSE = 'MIT (bundled template art, original to dsh-game-studio)'
export type TemplateId = typeof TEMPLATES[number]

export interface SlotSpec {
  file: string
  label: string
  size: [number, number]
  transparent: boolean
  tile?: boolean
  /** A repeating surface texture (3D ground) rather than a picture that covers the screen. */
  texture?: boolean
}

/** Script libraries a game can ask for; each is inlined into the build because exported games cannot reach the network. */
export const RUNTIMES = ['three'] as const
export type RuntimeId = typeof RUNTIMES[number]

export interface GameManifest {
  schema: 1
  template: TemplateId
  title: string
  /** Art direction shared by every generated asset, so they look like one game. */
  style?: string
  slots: Record<string, SlotSpec>
  rules: Record<string, unknown>
  runtime?: RuntimeId[]
  /** How the game is meant to be held; playtests and the sidebar preview follow it. Default portrait. */
  orientation?: Orientation
}

export const ORIENTATIONS = ['portrait', 'landscape'] as const
export type Orientation = typeof ORIENTATIONS[number]

/** One entry in assets/ASSETS.json. */
export interface AssetRecord {
  slot: string
  file: string
  /** `edited`: the file changed inside the project (by hand or by the agent), outside the studio's own apply. */
  source: 'template' | 'generated' | 'imported' | 'edited'
  provider?: string
  model?: string
  prompt?: string
  candidate?: string
  appliedAt: string
  /** Licence status of the asset itself, not of the plugin code. */
  license: string
  /** Content hash when recorded; a different file on disk means it was edited since. */
  sha256?: string
  /** The reference picture a generated asset followed. */
  reference?: { name: string; sha256: string }
  /** What an edited asset started from. */
  basedOn?: { source: AssetRecord['source']; file: string; license: string }
}

export interface AssetLedger { schema: 1; assets: Record<string, AssetRecord> }

const TEMPLATE_ROOT = fileURLToPath(new URL('../template/', import.meta.url))

export function templateDir(template: TemplateId): string {
  return join(TEMPLATE_ROOT, template)
}

export const paths = {
  manifest: (dir: string) => join(dir, 'game.json'),
  code: (dir: string) => join(dir, 'game.js'),
  ledger: (dir: string) => join(dir, 'assets', 'ASSETS.json'),
  studio: (dir: string) => join(dir, '.studio'),
  state: (dir: string) => join(dir, '.studio', 'state.json'),
  candidates: (dir: string, slot: string) => join(dir, '.studio', 'candidates', slot),
  history: (dir: string, slot: string) => join(dir, '.studio', 'history', slot),
  /** Content-addressed copies of every recorded asset version, so later edits stay revertible. */
  snapshots: (dir: string) => join(dir, '.studio', 'snapshots'),
  versions: (dir: string) => join(dir, '.studio', 'versions'),
  jobs: (dir: string) => join(dir, '.studio', 'jobs'),
  codexRun: (dir: string, run: string) => join(dir, '.studio', 'codex', run),
  playtests: (dir: string) => join(dir, '.studio', 'playtest'),
  renders: (dir: string) => join(dir, '.studio', 'renders'),
  artifact: (dir: string) => join(dir, 'dist', 'index.html'),
  exportDir: (dir: string) => join(dir, 'export'),
}

const TEMPLATE_FILES = ['game.js', 'game.json', 'assets']

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true } catch { return false }
}

/** Keep a content-addressed copy of one project file; returns its sha256. */
export async function snapshotAsset(dir: string, file: string): Promise<string> {
  const data = await readFile(join(dir, file))
  const hash = sha256(data)
  const target = join(paths.snapshots(dir), `${hash}${extname(file)}`)
  if (!await exists(target)) await writeFileAtomic(target, data)
  return hash
}

/** What game_studio_create may say about one slot: a new name, a new or changed slot, or null to drop it. */
export type SlotRequest = string | null | { label?: string; transparent?: boolean; size?: [number, number] }

const SLOT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,31}$/u

/** A plain stand-in picture for a slot the template has no art for, so the game builds and the sidebar can show it. */
export function placeholderSvg(label: string, transparent: boolean, [width, height]: [number, number]): string {
  const hue = [...label].reduce((sum, char) => (sum * 31 + char.codePointAt(0)!) % 360, 7)
  const initial = escapeXml([...label.trim()][0] ?? '?')
  const r = Math.round(Math.min(width, height) * 0.42)
  const shape = transparent
    ? `<circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="hsl(${hue} 60% 62%)" stroke="hsl(${hue} 45% 28%)" stroke-width="${Math.max(4, Math.round(r / 12))}"/>`
    : `<rect width="${width}" height="${height}" fill="hsl(${hue} 30% 78%)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<!-- Placeholder for "${escapeXml(label)}"; draw over this file or generate art for the slot. -->${shape}`
    + `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="700" `
    + `font-size="${Math.round(Math.min(width, height) * 0.36)}" fill="hsl(${hue} 45% 22%)">${initial}</text></svg>\n`
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function checkSize(slot: string, size: unknown): [number, number] | undefined {
  if (size === undefined) return undefined
  if (!Array.isArray(size) || size.length !== 2 || !size.every(n => Number.isInteger(n) && n >= 32 && n <= 2048)) {
    throw new StudioError(`Slot "${slot}": size must be [width, height] in whole pixels between 32 and 2048`, 'BAD_SLOTS')
  }
  return [size[0], size[1]]
}

export async function createProject(
  dir: string,
  options: { title: string; style?: string; template?: TemplateId; slots?: Record<string, SlotRequest>; orientation?: Orientation },
): Promise<GameManifest> {
  const template = options.template ?? 'collector'
  if (!TEMPLATES.includes(template)) throw new StudioError(`Unknown template "${template}". Available: ${TEMPLATES.join(', ')}`, 'BAD_TEMPLATE')
  if (options.orientation !== undefined && !ORIENTATIONS.includes(options.orientation)) {
    throw new StudioError(`Unknown orientation "${options.orientation}". Available: ${ORIENTATIONS.join(', ')}`, 'BAD_ORIENTATION')
  }
  if (await exists(paths.manifest(dir))) throw new StudioError(`A game already exists at ${dir}; pick another folder or edit that one`, 'EXISTS')
  if (await exists(dir) && (await readdir(dir)).length > 0) throw new StudioError(`Folder ${dir} is not empty; pick a new folder name`, 'NOT_EMPTY')
  // Work out the whole slot list before touching the disk, so a refused request leaves no half-made folder behind.
  const manifest = await readJson<GameManifest>(join(templateDir(template), 'game.json'))
  const drawn = new Map<string, SlotSpec>()
  const dropped: string[] = []
  for (const [slot, request] of Object.entries(options.slots ?? {})) {
    if (!SLOT_NAME.test(slot)) throw new StudioError(`Slot name "${slot}" must be letters, digits or _ and start with a letter (e.g. "card", "gem_red", "cardArt")`, 'BAD_SLOTS')
    // Slot files are named after the slot, and macOS and Windows folders ignore case.
    const clash = Object.keys(manifest.slots).find(other => other !== slot && other.toLowerCase() === slot.toLowerCase())
    if (clash) throw new StudioError(`Slot names "${slot}" and "${clash}" differ only in case; pick another name`, 'BAD_SLOTS')
    const existing = manifest.slots[slot]
    if (request === null) {
      if (existing) { dropped.push(existing.file); delete manifest.slots[slot] }
      continue
    }
    const wanted = typeof request === 'string' ? { label: request } : request
    if (typeof wanted !== 'object' || Array.isArray(wanted)) throw new StudioError(`Slot "${slot}" must be a name, an object or null`, 'BAD_SLOTS')
    const label = typeof wanted.label === 'string' && wanted.label.trim() ? wanted.label.trim().slice(0, 40) : undefined
    const size = checkSize(slot, wanted.size)
    if (existing && wanted.transparent === undefined && size === undefined) {
      if (label) existing.label = label
      continue
    }
    // A new slot, or a template slot redrawn to another shape: it gets a plain placeholder in that shape.
    const transparent = wanted.transparent ?? existing?.transparent ?? true
    const spec: SlotSpec = {
      file: `assets/${slot}.svg`, label: label ?? existing?.label ?? slot,
      size: size ?? existing?.size ?? (transparent ? [256, 256] : [512, 512]), transparent,
    }
    if (existing && existing.file !== spec.file) dropped.push(existing.file)
    manifest.slots[slot] = spec
    drawn.set(slot, spec)
  }
  if (Object.keys(manifest.slots).length === 0) throw new StudioError('A game needs at least one asset slot', 'BAD_SLOTS')
  if (Object.keys(manifest.slots).length > 12) throw new StudioError('At most 12 asset slots', 'BAD_SLOTS')

  await mkdir(dir, { recursive: true })
  for (const name of TEMPLATE_FILES) {
    await cp(join(templateDir(template), name), join(dir, name), { recursive: true })
  }
  for (const file of dropped) await rm(join(dir, file), { force: true })
  for (const spec of drawn.values()) await writeFileAtomic(join(dir, spec.file), placeholderSvg(spec.label, spec.transparent, spec.size))
  manifest.title = options.title.trim() || manifest.title
  if (options.style?.trim()) manifest.style = options.style.trim()
  if (options.orientation === 'landscape') manifest.orientation = 'landscape'
  await writeJson(paths.manifest(dir), manifest)
  const now = new Date().toISOString()
  const assets: Record<string, AssetRecord> = {}
  for (const [slot, spec] of Object.entries(manifest.slots)) {
    assets[slot] = {
      slot, file: spec.file, source: 'template', appliedAt: now,
      license: TEMPLATE_LICENSE, sha256: await snapshotAsset(dir, spec.file),
    }
  }
  const ledger: AssetLedger = { schema: 1, assets }
  await writeJson(paths.ledger(dir), ledger)
  return manifest
}

/** Slots whose sidebar name is still the template's generic one (Hero, Enemy, …). */
export async function unnamedSlots(manifest: GameManifest): Promise<string[]> {
  const original = await readJson<GameManifest>(join(templateDir(manifest.template), 'game.json')).catch(() => null)
  if (!original?.slots) return []
  return Object.entries(manifest.slots).filter(([slot, spec]) => original.slots[slot] !== undefined && spec.label === original.slots[slot]!.label).map(([slot]) => slot)
}

export async function loadManifest(dir: string): Promise<GameManifest> {
  const manifest = await readJson<GameManifest>(paths.manifest(dir))
  if (manifest === null || typeof manifest !== 'object' || manifest.schema !== 1 || typeof manifest.slots !== 'object') {
    throw new StudioError(`${paths.manifest(dir)} is not a dsh-game-studio manifest (schema 1)`, 'BAD_MANIFEST')
  }
  for (const [slot, spec] of Object.entries(manifest.slots)) {
    if (typeof spec?.file !== 'string' || spec.file.includes('..')) throw new StudioError(`Slot "${slot}" has an invalid file path`, 'BAD_MANIFEST')
  }
  manifest.rules ??= {}
  return manifest
}

export async function loadLedger(dir: string): Promise<AssetLedger> {
  try { return await readJson<AssetLedger>(paths.ledger(dir)) }
  catch (error) {
    if (error instanceof StudioError && error.code === 'NOT_FOUND') return { schema: 1, assets: {} }
    throw error
  }
}

export function requireSlot(manifest: GameManifest, slot: string): SlotSpec {
  const spec = manifest.slots[slot]
  if (spec === undefined) throw new StudioError(`Unknown slot "${slot}". Slots: ${Object.keys(manifest.slots).join(', ')}`, 'BAD_SLOT')
  return spec
}

export function projectName(dir: string): string {
  return basename(dir)
}
