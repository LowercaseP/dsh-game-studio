/**
 * Codex CLI provider. One image is one non-interactive `codex exec` run that
 * calls Codex's built-in image tool, so people who already sign in to Codex
 * can generate art without an image API key; it counts against their Codex
 * usage instead. Runs take minutes, so callers run them in the background.
 */
import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { delimiter, isAbsolute, join } from 'node:path'
import { StudioError } from '../util.ts'

export const CODEX_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const
export type CodexEffort = typeof CODEX_EFFORTS[number]

export interface CodexImageRequest {
  /** Resolved Codex executable. */
  command: string
  /** Empty folder the run works in; the image is saved there. */
  workDir: string
  /** Full image prompt (subject, style, framing). */
  prompt: string
  transparent: boolean
  /** File name of a reference picture already copied into workDir. */
  referenceFile?: string
  model?: string
  effort?: CodexEffort
  timeoutMs: number
  signal: AbortSignal
}

export interface CodexImageResult {
  image: Uint8Array
  /** Codex's own token count for the run, when it printed one. */
  tokens: number | null
  seconds: number
}

const IMAGE_FILE = /\.(png|jpe?g|webp)$/iu
const LOG_LIMIT = 64 * 1024
// eslint-disable-next-line no-control-regex -- matching terminal escape sequences is the point
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/gu

export function codexPrompt(prompt: string, transparent: boolean, referenceFile?: string): string {
  const format = transparent
    ? 'Square 1024x1024 PNG with a genuinely transparent background (real alpha channel; no white, black or checkerboard backdrop).'
    : 'Landscape 3:2 (about 1536x1024) opaque image that fills the whole frame.'
  return '$imagegen Generate exactly one image with the built-in image_gen tool, then copy the generated file into the current directory as image.png. '
    + 'Do not write or run scripts to inspect or change the image, do not create any other files, and do not ask questions.\n'
    + `Image: ${prompt}\nFormat: ${format}`
    + (referenceFile ? `\nReference: ./${referenceFile} is an input picture to follow for the subject's design, colours and style; do not edit, move or return it.` : '')
}

export function codexArgs(request: Pick<CodexImageRequest, 'workDir' | 'prompt' | 'transparent' | 'model' | 'effort' | 'referenceFile'>): string[] {
  const args = ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', request.workDir, '-c', 'approval_policy="never"']
  if (request.model) args.push('-m', request.model)
  if (request.effort) {
    if (!CODEX_EFFORTS.includes(request.effort)) throw new StudioError(`Unknown Codex reasoning effort "${request.effort}"`, 'BAD_CONFIG')
    args.push('-c', `model_reasoning_effort="${request.effort}"`)
  }
  args.push(codexPrompt(request.prompt, request.transparent, request.referenceFile))
  return args
}

async function isExecutable(path: string): Promise<boolean> {
  try { await access(path, constants.X_OK); return (await stat(path)).isFile() } catch { return false }
}

function runQuiet(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    let out = ''
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    const timer = setTimeout(() => { child.kill('SIGKILL') }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString('utf8') })
    child.on('error', () => { clearTimeout(timer); resolve('') })
    child.on('close', () => { clearTimeout(timer); resolve(out) })
  })
}

let resolved: Promise<string | undefined> | undefined

/**
 * Find the Codex executable: the configured path, then PATH, then the user's
 * login shell (apps started from the desktop often lack the shell's PATH,
 * e.g. an nvm-managed Node).
 */
export async function resolveCodex(configured?: string): Promise<string> {
  if (configured && (isAbsolute(configured) || configured.includes('/'))) {
    if (await isExecutable(configured)) return configured
    throw new StudioError(`Codex CLI not found at ${configured} (plugin option codexPath)`, 'NO_CODEX')
  }
  const name = configured || 'codex'
  resolved ??= (async () => {
    for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
      if (await isExecutable(join(dir, name))) return join(dir, name)
    }
    if (process.platform === 'win32') return undefined
    const shell = process.env.SHELL || '/bin/sh'
    const lines = (await runQuiet(shell, ['-ilc', `command -v ${name}`], 10_000)).split('\n').map(line => line.trim())
    for (const line of lines.reverse()) {
      if (line.startsWith('/') && await isExecutable(line)) return line
    }
    return undefined
  })()
  const found = await resolved
  if (found === undefined) {
    resolved = undefined
    throw new StudioError('Codex CLI was not found. Install it (npm i -g @openai/codex), sign in with `codex login`, '
      + 'or set the plugin option codexPath to its full path.', 'NO_CODEX')
  }
  return found
}

export async function findImage(workDir: string): Promise<string | undefined> {
  const preferred = join(workDir, 'image.png')
  try { await stat(preferred); return preferred } catch { /* look for any image */ }
  let newest: { path: string; time: number } | undefined
  for (const name of await readdir(workDir)) {
    // The reference picture is an input, never the answer.
    if (!IMAGE_FILE.test(name) || name.startsWith('reference.')) continue
    const info = await stat(join(workDir, name))
    if (info.isFile() && (newest === undefined || info.mtimeMs > newest.time)) newest = { path: join(workDir, name), time: info.mtimeMs }
  }
  return newest?.path
}

function tail(text: string, lines = 6): string {
  return text.trim().split('\n').filter(line => line.trim() !== '').slice(-lines).join(' | ').slice(0, 600)
}

/** Run one Codex image generation and return the saved image. */
export async function codexGenerate(request: CodexImageRequest): Promise<CodexImageResult> {
  await mkdir(request.workDir, { recursive: true })
  const started = Date.now()
  let log = ''
  const append = (chunk: Buffer) => {
    log += chunk.toString('utf8')
    if (log.length > LOG_LIMIT * 2) log = log.slice(-LOG_LIMIT)
  }
  const exit = await new Promise<{ code: number | null; reason?: 'timeout' | 'aborted'; error?: NodeJS.ErrnoException }>((resolve) => {
    // The Harness runs with FORCE_COLOR=1; plain output keeps Codex's log readable and parseable.
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' }
    delete env.FORCE_COLOR
    const child = spawn(request.command, codexArgs(request), { cwd: request.workDir, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let reason: 'timeout' | 'aborted' | undefined
    const stop = (why: 'timeout' | 'aborted') => {
      reason ??= why
      child.kill('SIGTERM')
      setTimeout(() => { child.kill('SIGKILL') }, 5_000).unref()
    }
    const timer = setTimeout(() => { stop('timeout') }, request.timeoutMs)
    const onAbort = () => { stop('aborted') }
    if (request.signal.aborted) onAbort()
    else request.signal.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    const finish = (result: { code: number | null; error?: NodeJS.ErrnoException }) => {
      clearTimeout(timer)
      request.signal.removeEventListener('abort', onAbort)
      resolve({ ...result, ...(reason ? { reason } : {}) })
    }
    child.on('error', error => { finish({ code: null, error }) })
    child.on('close', code => { finish({ code }) })
  })
  log = log.replace(ANSI, '')
  await writeFile(join(request.workDir, 'codex.log'), log.slice(-LOG_LIMIT)).catch(() => undefined)
  if (exit.error) {
    if (exit.error.code === 'ENOENT') throw new StudioError(`Codex CLI not found at ${request.command}`, 'NO_CODEX')
    throw new StudioError(`Could not start Codex: ${exit.error.message}`, 'PROVIDER')
  }
  // Codex may be stopped after it saved the picture but before its turn ended; a finished picture is kept.
  const file = await findImage(request.workDir)
  if (file === undefined && exit.reason === 'aborted') throw new StudioError('Codex image generation was cancelled', 'CANCELLED')
  if (file === undefined && exit.reason === 'timeout') throw new StudioError(`Codex did not finish within ${Math.round(request.timeoutMs / 60_000)} minutes`, 'TIMEOUT')
  if (file === undefined) {
    throw new StudioError(`Codex finished (exit ${exit.code}) without saving an image: ${tail(log) || 'no output'}`, 'PROVIDER')
  }
  const used = /tokens used\s*\n?\s*([\d,]+)/iu.exec(log)?.[1]
  return {
    image: new Uint8Array(await readFile(file)),
    tokens: used === undefined ? null : Number(used.replace(/,/gu, '')),
    seconds: Math.round((Date.now() - started) / 1000),
  }
}
