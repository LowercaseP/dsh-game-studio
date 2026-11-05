/**
 * Whole-game versions: every build that changed the game is kept as a version
 * (game.js, game.json and every asset, stored by content hash), so the user can
 * go back to any earlier direction. Going back is itself a new build, so it can
 * be undone the same way.
 */
import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { BuildResult } from './build.ts'
import { paths } from './project.ts'
import { readJson, serialized, sha256, StudioError, writeFileAtomic, writeJson } from './util.ts'

export interface VersionMeta {
  number: number
  buildId: string
  createdAt: string
  /** What changed, in a few words ("Applied Hero #2", "Rebuilt after rule change"). */
  note: string
  title: string
  bytes: number
  /** Project-relative path → content hash in the snapshot store. */
  files: Record<string, string>
}

const MAX_VERSIONS = 40

async function projectFiles(dir: string): Promise<string[]> {
  const files = ['game.js', 'game.json']
  for (const name of await readdir(join(dir, 'assets'))) files.push(`assets/${name}`)
  return files
}

async function storeFile(dir: string, file: string): Promise<string> {
  const data = await readFile(join(dir, file))
  const hash = sha256(data)
  const target = join(paths.snapshots(dir), `${hash}${extname(file)}`)
  try { await stat(target) } catch { await writeFileAtomic(target, data) }
  return hash
}

export async function listVersions(dir: string): Promise<VersionMeta[]> {
  let names: string[]
  try { names = await readdir(paths.versions(dir)) } catch { return [] }
  const metas = await Promise.all(names.filter(name => /^\d+\.json$/u.test(name))
    .map(name => readJson<VersionMeta>(join(paths.versions(dir), name)).catch(() => undefined)))
  return metas.filter((meta): meta is VersionMeta => meta !== undefined).sort((a, b) => b.number - a.number)
}

/** Keep the just-built game as a new version unless it is the same build as the latest one. */
export function recordVersion(dir: string, build: BuildResult, note: string): Promise<VersionMeta | null> {
  return serialized(`${dir}\0versions`, async () => {
    const versions = await listVersions(dir)
    if (versions[0]?.buildId === build.buildId) return null
    const files: Record<string, string> = {}
    for (const file of await projectFiles(dir)) files[file] = await storeFile(dir, file)
    const meta: VersionMeta = {
      number: (versions[0]?.number ?? 0) + 1, buildId: build.buildId, createdAt: new Date().toISOString(),
      note: note.trim().slice(0, 120) || 'Built', title: build.title, bytes: build.bytes, files,
    }
    await writeJson(join(paths.versions(dir), `${meta.number}.json`), meta)
    for (const old of versions.slice(MAX_VERSIONS - 1)) await rm(join(paths.versions(dir), `${old.number}.json`), { force: true })
    return meta
  })
}

/**
 * Put the project's files back as they were in one version. Asset files that
 * version did not have are removed; the caller rebuilds, which records the
 * result as the newest version.
 */
export async function restoreFiles(dir: string, number: number): Promise<VersionMeta> {
  const versions = await listVersions(dir)
  const meta = versions.find(version => version.number === number)
  if (meta === undefined) throw new StudioError(`There is no version ${number}; versions kept: ${versions.map(v => v.number).join(', ') || 'none'}`, 'NO_VERSION')
  const contents: Array<[string, Uint8Array]> = []
  for (const [file, hash] of Object.entries(meta.files)) {
    if (file.includes('..')) throw new StudioError(`Version ${number} lists an invalid path`, 'BAD_VERSION')
    try { contents.push([file, await readFile(join(paths.snapshots(dir), `${hash}${extname(file)}`))]) }
    catch { throw new StudioError(`Version ${number} is incomplete (${file} is missing from the snapshot store)`, 'BAD_VERSION') }
  }
  for (const name of await readdir(join(dir, 'assets'))) {
    if (!(`assets/${name}` in meta.files)) await rm(join(dir, 'assets', name), { force: true })
  }
  for (const [file, data] of contents) await writeFileAtomic(join(dir, file), data)
  return meta
}
