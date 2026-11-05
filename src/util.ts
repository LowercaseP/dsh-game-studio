/** Small filesystem and JSON helpers shared by the Host modules. */
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

/** Error whose message is meant for the model and the user as-is. */
export class StudioError extends Error {
  readonly code: string
  constructor(message: string, code = 'STUDIO_ERROR') {
    super(message)
    this.name = 'StudioError'
    this.code = code
  }
}

export async function readJson<T>(path: string): Promise<T> {
  let raw: string
  try { raw = await readFile(path, 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new StudioError(`File not found: ${path}`, 'NOT_FOUND')
    throw error
  }
  try { return JSON.parse(raw) as T }
  catch { throw new StudioError(`Invalid JSON in ${path}`, 'BAD_JSON') }
}

/** Write through a temporary sibling so readers never see a half-written file. */
export async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, data)
  await rename(temp, path)
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, undefined, 2)}\n`)
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

export function shortId(): string {
  return `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}

/**
 * Resolve a user/model supplied path against the session working directory and
 * refuse anything that escapes it.
 */
export function resolveInside(cwd: string, path: string): string {
  const target = isAbsolute(path) ? resolve(path) : resolve(cwd, path)
  const rel = relative(cwd, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new StudioError(`Path must stay inside the session working directory (${cwd}): ${path}`, 'OUTSIDE_WORKSPACE')
  }
  return target
}

/** Lossless-JSON friendly number: finite, rounded, never -0. */
export function num(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return rounded === 0 ? 0 : rounded
}

/** Drop keys whose value is undefined so tool results stay lossless JSON. */
export function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

export function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  throw new StudioError(`Unsupported asset type: ${path} (use png, jpg, webp or svg)`, 'BAD_ASSET')
}

const queues = new Map<string, Promise<unknown>>()

/** Run `task` after every earlier task with the same key has settled, so read-modify-write steps never interleave. */
export function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task)
  queues.set(key, next)
  return next
}
