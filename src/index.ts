/**
 * dsh-game-studio Host plugin: agent tools and one `/game-studio` command that
 * share the same operations, so the sidebar buttons and the agent do exactly
 * the same thing.
 */
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  applyCandidate, generateCandidates, prepareGeneration, revertSlot, withProjectLock, writeState,
  type CandidateMeta, type Generation, type ImageGenerator,
} from './assets.ts'
import { buildProject } from './build.ts'
import { runCodexBatch, type CodexBatch } from './generation.ts'
import { openaiCost } from './pricing.ts'
import { describePlaytest, GAME_STATE_CONTRACT, playtest, RENDERS_CONTRACT } from './playtest.ts'
import { loadReference, type ReferenceImage } from './reference.ts'
import { startShare, stopAllShares, stopShare } from './share.ts'
import { askToShare, askToSpend, spendNotice } from './spend.ts'
import { listVersions, restoreFiles } from './versions.ts'
import { createProject, loadManifest, ORIENTATIONS, paths, TEMPLATES, unnamedSlots, type SlotRequest } from './project.ts'
import { CODEX_EFFORTS, resolveCodex, type CodexEffort } from './providers/codex.ts'
import { OPENAI_DEFAULT_MODEL, openaiGenerate } from './providers/openai.ts'
import { resolveInside, shortId, StudioError } from './util.ts'

/** Told to the agent so it never goes looking for how the asset ledger works. */
const EDIT_SLOT_FILES = 'You may draw a slot\'s picture yourself by overwriting its file in assets/ (e.g. write your own SVG); '
  + 'the studio notices on the next build and records it as your edit, so leave assets/ASSETS.json alone.'

const SLOTS_EXAMPLE = '{"hero": "小鸡", "enemy": "狐狸", "card": {"label": "卡面", "size": [256, 384]}, "pickup": null}'

/** The slots argument of game_studio_create, as a JSON string or an object. */
function parseSlots(value: unknown): Record<string, SlotRequest> | undefined {
  if (value === undefined || value === null || value === '') return undefined
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) }
    catch { throw new StudioError(`slots must be a JSON object, e.g. ${SLOTS_EXAMPLE}`, 'BAD_SLOTS') }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StudioError(`slots must be a JSON object, e.g. ${SLOTS_EXAMPLE}`, 'BAD_SLOTS')
  }
  return parsed as Record<string, SlotRequest>
}

function namingHint(slots: string[]): string {
  return `The sidebar still calls ${slots.join(', ')} by the template's generic names; set slots.<slot>.label in game.json `
    + 'to the user\'s characters, in their language (e.g. "小鸡"), so the sidebar names them.'
}

export const name = 'dsh-game-studio'
export const inject = ['tools', 'workingDirectory']

export interface Config {
  /** OpenAI image model; pin it so results stay comparable. */
  openaiModel?: string
  /** OpenAI-compatible base URL, e.g. a company gateway. */
  openaiBaseUrl?: string
  /** Name of the credential (or environment variable) holding the API key. */
  openaiCredential?: string
  /** Image service: `auto` uses OpenAI when its key is set and otherwise the Codex CLI. */
  imageProvider?: 'auto' | 'openai' | 'codex'
  /** Codex CLI executable; found on PATH or through the login shell when unset. */
  codexPath?: string
  /** Model for Codex image runs; Codex's own default when unset. */
  codexModel?: string
  /** Reasoning effort for Codex image runs. Default low: the run only calls the image tool. */
  codexReasoningEffort?: CodexEffort
  /** Give up on one Codex image after this many minutes. Default 15. */
  codexTimeoutMinutes?: number
  /** Ask the user to approve each generation (service, image count, expected cost) before it runs. Default true. */
  confirmSpending?: boolean
}

const QUALITIES = ['low', 'medium', 'high'] as const

const PROVIDERS = ['openai', 'codex'] as const
type Provider = typeof PROVIDERS[number]

function candidateSummary(item: CandidateMeta) {
  return { number: item.number, id: item.id, file: item.file, pass: item.checks.pass, problems: item.checks.problems, model: item.model }
}

/** Shape the sidebar reads from tool presentation metadata. */
function presentation(kind: string, project: string, extra: Record<string, unknown> = {}) {
  return { studio: 1, kind, project, ...extra } as any
}

export function apply(ctx: any, config: Config = {}): void {
  const model = config.openaiModel ?? OPENAI_DEFAULT_MODEL
  const credentialName = config.openaiCredential ?? 'OPENAI_API_KEY'
  let credentials: any
  let jobs: any
  let approval: any
  let attachments: any

  ctx.inject(['credentials'], (child: any) => {
    credentials = child.credentials
    child.effect(() => () => { credentials = undefined })
  })
  ctx.inject(['jobs'], (child: any) => {
    jobs = child.jobs
    child.effect(() => () => { jobs = undefined })
  })
  ctx.inject(['approval'], (child: any) => {
    approval = child.approval
    child.effect(() => () => { approval = undefined })
  })

  ctx.inject(['attachments'], (child: any) => {
    attachments = child.attachments
    child.effect(() => () => { attachments = undefined })
  })

  ctx.effect(() => () => { stopAllShares() })

  /** Whether the model behind this call can look at images (the same check DSH's read_image makes). */
  async function seesImages(exec: any): Promise<boolean> {
    try {
      const routed = exec.agent?.session?.requestHeader?.()?.config
      const provider = routed?.provider ?? exec.agent?.options?.provider
      const model = routed?.model ?? exec.agent?.options?.model
      const llm = ctx.get?.('llm')
      if (provider === undefined || model === undefined || llm === undefined) return false
      const info = await llm.resolveModelInfo(provider, model, exec.signal)
      return Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')
    } catch {
      return false
    }
  }

  async function confirmSpend(exec: any, provider: Provider, generation: Generation, count: number, quality: string, reference?: ReferenceImage): Promise<void> {
    if (config.confirmSpending === false) return
    const notice = spendNotice({
      provider, model, label: generation.spec.label, wide: !generation.spec.transparent, count, quality,
      ...(reference ? { reference: reference.name, ...(reference.fromChat ? { referenceFromChat: true } : {}) } : {}),
    })
    await askToSpend(approval, exec, 'game_studio_generate_asset', notice)
  }

  async function apiKey(): Promise<string> {
    try {
      const hit = await credentials?.resolve(credentialName)
      if (typeof hit?.value === 'string' && hit.value.length > 0) return hit.value
    } catch { /* fall through to the environment */ }
    const value = process.env[credentialName]
    if (value) return value
    throw new StudioError(
      `No image-generation key: store a credential named ${credentialName} in DSH, or start DSH with ${credentialName} set. `
      + 'The game still runs with its bundled art without a key.', 'NO_KEY')
  }

  async function hasOpenAIKey(): Promise<boolean> {
    try { await apiKey(); return true } catch { return false }
  }

  async function chooseProvider(requested?: Provider): Promise<Provider> {
    const wanted = requested ?? config.imageProvider ?? 'auto'
    if (wanted !== 'auto') return wanted
    if (await hasOpenAIKey()) return 'openai'
    try { await resolveCodex(config.codexPath); return 'codex' } catch { /* neither is set up */ }
    throw new StudioError(
      `No image service is set up. Store an OpenAI key as ${credentialName} (fast, billed per image), `
      + 'or install and sign in to the Codex CLI (uses your Codex plan, minutes per image). '
      + 'The game still runs with its bundled art without one.', 'NO_PROVIDER')
  }

  async function codexBatch(count: number): Promise<CodexBatch> {
    const effort = config.codexReasoningEffort ?? 'low'
    if (!CODEX_EFFORTS.includes(effort)) throw new StudioError(`codexReasoningEffort must be one of ${CODEX_EFFORTS.join(', ')}`, 'BAD_CONFIG')
    return {
      command: await resolveCodex(config.codexPath), count, effort,
      ...(config.codexModel ? { model: config.codexModel } : {}),
      timeoutMs: Math.max(1, config.codexTimeoutMinutes ?? 15) * 60_000,
    }
  }

  /** Run Codex as an owned background job; the agent gets a completion notice with the candidate ids. */
  function startCodexJob(dir: string, generation: Generation, batch: CodexBatch, exec: any): string {
    return jobs.start({
      kind: 'game-studio',
      label: `Codex: ${batch.count} ${generation.slot} image${batch.count === 1 ? '' : 's'} for ${basename(dir)}`,
      owner: exec.agent.id,
      ...(exec.callId !== undefined ? { toolCall: { callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId } } : {}),
      run: (job: any) => {
        const controller = new AbortController()
        const done = runCodexBatch(dir, generation, batch, String(job.id), controller.signal, (line) => { job.updateProgress(line) })
          .then(result => ({
            status: result.status,
            ...(result.errors.length > 0 ? { detail: result.errors[0]!.slice(0, 300) } : {}),
            result: JSON.stringify({
              project: dir, slot: generation.slot,
              candidates: result.candidates.sort((a, b) => a.number - b.number)
                .map(item => ({ number: item.number, id: item.id, pass: item.checks.pass, problems: item.checks.problems })),
              errors: result.errors,
              next: 'The candidates are in the Game Studio sidebar, labelled by number. Apply one with game_studio_apply_asset after the user picks it.',
            }),
          }), (error: unknown) => ({ status: 'failed' as const, detail: error instanceof Error ? error.message : String(error) }))
        return { cancel: (reason?: string) => { controller.abort(reason) }, done }
      },
    })
  }

  function generator(signal: AbortSignal): ImageGenerator {
    return async (request) => {
      const response = await openaiGenerate({ ...request, apiKey: await apiKey(), baseUrl: config.openaiBaseUrl, model, signal })
      return { ...response, provider: 'openai' }
    }
  }

  async function projectDir(exec: any, path: string): Promise<string> {
    if (exec.agent === undefined) throw new StudioError('This tool needs an agent session', 'NO_SESSION')
    const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
    return resolveInside(cwd, path)
  }

  async function restoreVersion(dir: string, version: number) {
    const restored = await withProjectLock(dir, () => restoreFiles(dir, version))
    const build = await buildProject(dir, `Back to version ${restored.number}`)
    await writeState(dir, build)
    return { restored: restored.number, note: restored.note, buildId: build.buildId }
  }

  async function shareGame(dir: string, minutes: number) {
    const info = await startShare(dir, minutes)
    await writeState(dir)
    return { url: info.url, expiresAt: info.expiresAt }
  }

  async function exportGame(dir: string, fileName?: string) {
    const manifest = await loadManifest(dir)
    const build = await buildProject(dir, 'Exported')
    await writeState(dir, build)
    const slug = (fileName ?? manifest.title).normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'game'
    const target = join(paths.exportDir(dir), `${slug}.html`)
    await mkdir(paths.exportDir(dir), { recursive: true })
    await copyFile(build.artifact, target)
    return { file: target, bytes: (await stat(target)).size, buildId: build.buildId }
  }

  const projectParam = { type: 'string', required: true, description: 'Game project folder, relative to the working directory.' } as const
  const slotParam = { type: 'string', required: true, description: 'Asset slot name from game.json (the template\'s hero, enemy, pickup, background, or one the game added).' } as const
  const json = { type: 'json' } as const

  ctx.tools.register(defineTool({
    name: 'game_studio_create',
    description: 'Create a playable small web game from a built-in template, build it, and show it in the Game Studio sidebar. '
      + 'Templates: "collector" (default) is a 60-second 2D top-down collect-and-dodge game; "voxel" is the same loop in a 3D voxel world '
      + '(Three.js, WebGL), whose characters are voxel models until the user applies their own art, which then shows as camera-facing sprites. '
      + 'When you reshape the voxel models, edit the boxes listed in MODELS in game.js and keep MODELS and window.__renderSlots. '
      + RENDERS_CONTRACT + ' ' + GAME_STATE_CONTRACT + ' ' + EDIT_SLOT_FILES + ' '
      + 'The new folder contains game.json (title, art style, asset slots, rules; rules are free-form: add any key and read it in game.js '
      + 'as window.GAME.rules.<key>, builds do not check rule names), '
      + 'game.js (the game code you may edit), and assets/. After this, offer to generate the user\'s own art with game_studio_generate_asset.',
    parameters: {
      path: { ...projectParam, description: 'New, empty folder for the game, relative to the working directory.' },
      title: { type: 'string', required: true, description: 'Game title shown on the title screen.' },
      style: { type: 'string', description: 'Art direction shared by all generated assets, e.g. "watercolor storybook, warm palette".' },
      template: { type: 'string', enum: TEMPLATES, description: 'Which template to start from. Default collector; use voxel when the user asks for 3D.' },
      orientation: { type: 'string', enum: ORIENTATIONS, description: 'How the game is held: portrait (default, phone upright) or landscape '
        + '(side-scrollers, wide tracks or boards). Playtests and the sidebar preview follow it; it is saved as "orientation" in game.json.' },
      slots: { type: 'json', description: 'The game\'s art slots, as the sidebar shows them and AI art is made for: an object by slot name. '
        + 'A string renames a template slot after the user\'s character, in the user\'s language; '
        + 'an object {label, transparent (default true; false for a full-screen picture), size [w, h]} adds a new slot, or redraws a template slot to that shape '
        + '(e.g. a full portrait background), with a plain placeholder picture; '
        + 'null drops a template slot the game does not need. Give each kind of picture the game really draws its own slot '
        + '(cards, gems, towers, customers) instead of forcing them into hero / enemy / pickup. '
        + `Each slot's picture reaches game.js as window.GAME.assets.<slot> (a data: URL). E.g. ${SLOTS_EXAMPLE}.` },
    },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('preview', value.project, { buildId: value.build.buildId }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const manifest = await createProject(dir, {
        title: args.title, style: args.style, template: args.template ?? 'collector', slots: parseSlots(args.slots),
        ...(args.orientation !== undefined ? { orientation: args.orientation } : {}),
      })
      const build = await buildProject(dir, `Created from the ${args.template ?? 'collector'} template`)
      await writeState(dir, build)
      const unnamed = await unnamedSlots(manifest)
      return {
        project: dir, title: manifest.title, orientation: manifest.orientation ?? 'portrait',
        slots: Object.fromEntries(Object.entries(manifest.slots).map(([slot, spec]) => [slot, spec.label])), rules: manifest.rules,
        build: { buildId: build.buildId, bytes: build.bytes },
        note: 'Playable now with bundled art. Read game.json and game.js before you edit them (files you have not read cannot be edited), '
          + 'change rules in game.json or code in game.js, then call game_studio_build.'
          + (unnamed.length > 0 ? ` ${namingHint(unnamed)}` : ''),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_build',
    description: 'Rebuild the game after editing game.json or game.js, and refresh the Game Studio sidebar preview. '
      + 'Always call it after code or rule changes; check `node --check game.js` first if you edited the script. '
      + 'Every build that changed the game is kept as a version the user can go back to; pass a short note saying what changed. '
      + 'To check that the change works, call game_studio_playtest. ' + RENDERS_CONTRACT + ' ' + EDIT_SLOT_FILES,
    parameters: {
      path: projectParam,
      note: { type: 'string', description: 'A few words on what changed, shown in the version list (e.g. "Shield every 5 lanterns").' },
    },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('preview', value.project, { buildId: value.buildId }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const build = await buildProject(dir, args.note ?? 'Rebuilt')
      await writeState(dir, build)
      const unnamed = await unnamedSlots(await loadManifest(dir))
      return {
        project: dir, buildId: build.buildId, bytes: build.bytes, artifact: build.artifact,
        ...(unnamed.length > 0 ? { note: namingHint(unnamed) } : {}),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_generate_asset',
    description: 'Generate candidate art for one asset slot. Two image services: openai (GPT Image API, about a minute, '
      + 'billed per image to the user\'s API key) and codex (the local Codex CLI and the user\'s Codex sign-in, no API key, '
      + 'several minutes per image, runs in the background and you get a completion notice). Omit provider to use the configured default. '
      + 'Before anything is spent the user is asked to approve the service, image count and expected cost; if they decline, ask what they want instead. '
      + 'Each candidate in a batch is a different take. Sprites must come back transparent; every image is checked for transparency '
      + 'and framing and fitted to the slot. Candidates are numbered per slot (#1, #2, …) in the sidebar and in this result; '
      + 'talk about them by those numbers, and apply one with game_studio_apply_asset only after the user picks it or asked you to choose.',
    parameters: {
      path: projectParam,
      slot: slotParam,
      prompt: { type: 'string', required: true, description: 'What the asset should depict, in the user\'s words plus any detail you add. The art style from game.json is added automatically.' },
      count: { type: 'integer', description: 'Number of candidates, 1-4. Default 2.' },
      quality: { type: 'string', enum: QUALITIES, description: 'Image quality for openai. Default medium. Ignored by codex.' },
      provider: { type: 'string', enum: PROVIDERS, description: 'Image service for this call. Omit to use the configured default.' },
      reference: { type: 'string', description: 'Optional reference picture the art should follow (design, colours, style): a path in the working directory or of an image the user attached in chat.' },
    },
    // Only reached when Codex has to run inside the call (no background jobs in this host).
    timeoutMs: 1_800_000,
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (args: any, value: any) => presentation('candidates', value.project, {
        slot: args.slot, provider: value.provider, count: value.count, job: value.job ?? null,
        candidates: value.candidates.map((item: any) => ({ id: item.id, file: item.file, pass: item.pass })),
      }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const count = Math.min(4, Math.max(1, Math.trunc(args.count ?? 2)))
      const provider = await chooseProvider(args.provider)
      const quality = provider === 'openai' ? (args.quality ?? 'medium') : 'auto'
      const generation = await prepareGeneration(dir, args.slot, args.prompt, quality)
      const reference = args.reference ? await loadReference(await ctx.workingDirectory.ensure(exec.agent, exec.signal), String(args.reference)) : undefined
      const batch = provider === 'codex' ? { ...await codexBatch(count), ...(reference ? { reference } : {}) } : undefined
      await confirmSpend(exec, provider, generation, count, quality, reference)
      if (batch === undefined) {
        const { candidates, errors } = await generateCandidates(dir, args.slot, args.prompt, { count, quality, ...(reference ? { reference } : {}) }, generator(exec.signal))
        const cost = candidates.reduce((sum, item) => sum + (openaiCost(item.model, item.usage) ?? 0), 0)
        return {
          project: dir, slot: args.slot, provider, count, candidates: candidates.map(candidateSummary), errors,
          costUsd: Math.round(cost * 10_000) / 10_000,
        }
      }
      let job: string | undefined
      // start() refuses when no job controller serves this agent; Codex then runs inside the call.
      try { job = jobs === undefined ? undefined : startCodexJob(dir, generation, batch, exec) } catch { job = undefined }
      if (job !== undefined) {
        return {
          project: dir, slot: args.slot, provider, count, job, status: 'running', candidates: [], usage: null,
          note: `Codex is drawing ${count} image${count === 1 ? '' : 's'} in the background, usually 3-6 minutes. `
            + 'Each candidate shows up in the Game Studio sidebar as soon as it is ready, and you will get a completion notice with the ids. '
            + 'Tell the user it is running; do not wait or poll.',
        }
      }
      const result = await runCodexBatch(dir, generation, batch, `codex-${shortId()}`, exec.signal)
      if (result.candidates.length === 0) throw new StudioError(`Codex produced no image: ${result.errors[0] ?? 'unknown error'}`, 'PROVIDER')
      return { project: dir, slot: args.slot, provider, count, candidates: result.candidates.map(candidateSummary), errors: result.errors, usage: null }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_apply_asset',
    description: 'Put one generated candidate into the game for its slot, rebuild, and refresh the preview. '
      + 'The previous asset is kept and can be restored with game_studio_revert_asset.',
    parameters: {
      path: projectParam, slot: slotParam,
      candidate: { type: 'string', required: true, description: 'The candidate\'s number as shown in the sidebar ("2" or "#2"), or its id.' },
    },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('preview', value.project, { buildId: value.buildId }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const { record, candidate, build } = await applyCandidate(dir, args.slot, String(args.candidate))
      return { project: dir, slot: args.slot, number: candidate.number, file: record.file, buildId: build.buildId, license: record.license }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_revert_asset',
    description: 'Restore the previous asset of a slot, rebuild, and refresh the preview.',
    parameters: { path: projectParam, slot: slotParam },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('preview', value.project, { buildId: value.buildId }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const { restored, build } = await revertSlot(dir, args.slot)
      return { project: dir, slot: args.slot, restored, buildId: build.buildId }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_export',
    description: 'Export the game as one self-contained HTML file (no network, works offline, opens in any browser or on a static host) '
      + 'into the project\'s export/ folder.',
    parameters: { path: projectParam, name: { type: 'string', description: 'File name without extension. Defaults to the game title.' } },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('export', value.project, { file: value.file }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      return { project: dir, ...(await exportGame(dir, args.name)) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_versions',
    description: 'List the saved versions of the game, newest first. Every build that changed the game is a version '
      + '(code, rules and art together); the user can go back to any of them with game_studio_restore_version.',
    parameters: { path: projectParam },
    output: { schema: json, render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      const versions = await listVersions(dir)
      return {
        project: dir,
        versions: versions.slice(0, 20).map(v => ({ version: v.number, note: v.note, createdAt: v.createdAt, buildId: v.buildId })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_restore_version',
    description: 'Go back to an earlier version of the whole game (code, rules and art), rebuild, and refresh the preview. '
      + 'The current state stays in the list, so going back can be undone the same way.',
    parameters: { path: projectParam, version: { type: 'integer', required: true, description: 'Version number from game_studio_versions or the sidebar.' } },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('preview', value.project, { buildId: value.buildId }),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      return { project: dir, ...(await restoreVersion(dir, Math.trunc(args.version))) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_playtest',
    description: 'Play the latest game code in a headless Chrome or Edge on this computer and report what happened: '
      + 'phase changes (title → playing → won/lost), best score, hearts, frame rate, script errors, whether the hero stayed in view, '
      + 'and screenshots of the title, mid-game and end screens, plus close-ups of characters the game draws in code. '
      + GAME_STATE_CONTRACT + ' Use this instead of writing your own browser or screenshot scripts. '
      + 'Pass `rules` to change rules for this run only (e.g. {"duration": 3} to reach the win screen, {"hearts": 1} to test losing); '
      + 'the project, its build and its version history are not changed. '
      + 'While reshaping a character, pass characters: true to get only the close-ups, one image per slot, in a few seconds; '
      + 'do not write your own render scripts.',
    parameters: {
      path: projectParam,
      characters: { type: 'boolean', description: 'Only draw the close-ups of code-drawn characters (no play): fast, one image per slot. Default false.' },
      seconds: { type: 'integer', description: 'How long the autopilot plays, 1-60. Default 15.' },
      rules: { type: 'string', description: 'JSON object of rule overrides from game.json for this run only, e.g. {"duration": 3}.' },
      portrait: { type: 'boolean', description: 'true plays on a phone-shaped 390×844 touch screen, false at 960×540 landscape. '
        + 'Default follows "orientation" in game.json (portrait unless it says landscape); set that instead of passing this every time.' },
    },
    timeoutMs: 180_000,
    output: {
      schema: json,
      render: (_args: any, value: any) => [
        { type: 'text', text: value.summary },
        ...(value.images ?? []).flatMap((image: any) => [
          { type: 'text', text: `${image.name}:` },
          { type: 'image', attachment: image.attachment },
        ]),
      ],
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      let rules: Record<string, unknown> | undefined
      if (args.rules !== undefined && String(args.rules).trim() !== '') {
        try { rules = typeof args.rules === 'string' ? JSON.parse(args.rules) : args.rules }
        catch { throw new StudioError('rules must be a JSON object, e.g. {"duration": 3}', 'BAD_RULES') }
        if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) throw new StudioError('rules must be a JSON object, e.g. {"duration": 3}', 'BAD_RULES')
      }
      const report = await playtest(dir, {
        ...(args.seconds !== undefined ? { seconds: Number(args.seconds) } : {}),
        ...(rules ? { rules } : {}),
        ...(typeof args.portrait === 'boolean' ? { portrait: args.portrait } : {}),
        ...(args.characters === true ? { charactersOnly: true } : {}),
        signal: exec.signal,
      })
      let summary = describePlaytest(report).replaceAll(`${dir}/`, '')
      const images: Array<{ name: string; attachment: unknown }> = []
      if (attachments !== undefined && await seesImages(exec)) {
        // One tool result is one message; keep its images inside the per-message byte limit.
        const limits = attachments.imageLimits ?? {}
        let budget = Math.min(limits.maxImageBytes ?? Infinity, limits.maxMessageImageBytes ?? Infinity)
        const order = ['characters', 'mid', 'end', 'title']
        for (const shot of [...report.shots].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))) {
          const data = await readFile(shot.file)
          if (data.byteLength > budget) continue
          try {
            images.push({ name: shot.name, attachment: await attachments.saveImage({ data: new Uint8Array(data), mediaType: shot.mediaType, name: basename(shot.file) }) })
            budget -= data.byteLength
          } catch { /* the file path in the summary still points at it */ }
        }
      } else {
        summary += '\nThis model cannot view images here; open the screenshots with read_image if it can, or describe them from the numbers above.'
      }
      return {
        project: dir, summary, finalPhase: report.finalPhase, bestScore: report.bestScore,
        errors: report.errors.length, runDir: relative(dir, report.runDir), images,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'game_studio_share',
    description: 'Let a phone on the same Wi-Fi play the game: opens a temporary read-only link on the local network that serves only '
      + 'this game\'s latest build, and shows its QR code in the Game Studio sidebar. The user approves it first. '
      + 'It stops after `minutes` (default 30) or with stop: true. Rebuilds show up on the phone after a refresh.',
    parameters: {
      path: projectParam,
      minutes: { type: 'integer', description: 'How long the link stays open, 1-240. Default 30.' },
      stop: { type: 'boolean', description: 'Close the link now instead.' },
    },
    output: {
      schema: json,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args: any, value: any) => presentation('share', value.project, {}),
    },
    async execute(args: any, exec: any) {
      const dir = await projectDir(exec, args.path)
      if (args.stop === true) {
        const stopped = stopShare(dir)
        await writeState(dir)
        return { project: dir, stopped }
      }
      const minutes = Math.min(240, Math.max(1, Math.trunc(args.minutes ?? 30)))
      const title = (await loadManifest(dir)).title
      await askToShare(approval, exec, 'game_studio_share', {
        en: `Open a temporary link on your local network for ${minutes} minutes so a phone on the same Wi-Fi can play "${title}". Only this game's latest build is served.`,
        zh: `在局域网开放一个临时试玩链接 ${minutes} 分钟，让同一 Wi-Fi 下的手机能玩《${title}》。只提供这个游戏最新的构建文件。`,
      })
      return { project: dir, ...(await shareGame(dir, minutes)), note: 'The QR code is in the Game Studio sidebar.' }
    },
  }))

  // The sidebar's buttons call the same operations through this command.
  // Input: `<action> <json>`, where json carries an absolute project path.
  ctx.inject(['commands'], (child: any) => {
    child.commands.register({
      name: 'game-studio',
      description: 'Game Studio sidebar actions (apply, revert, build, export, restore, share, unshare)',
      input: { hint: '<apply|revert|build|export|restore|share|unshare> {"project": "...", ...}' },
      async handler({ agent, rawInput }: any) {
        try {
          // The Harness passes everything after `/game-studio`, leading whitespace included.
          const input = String(rawInput).trim()
          const space = input.search(/\s/u)
          const action = space < 0 ? input : input.slice(0, space)
          const payload = space < 0 ? {} : JSON.parse(input.slice(space + 1))
          const cwd = await ctx.workingDirectory.ensure(agent)
          const dir = resolveInside(cwd, String(payload.project ?? ''))
          let result: unknown
          if (action === 'apply') result = await applyCandidate(dir, String(payload.slot), String(payload.candidate))
          else if (action === 'revert') result = await revertSlot(dir, String(payload.slot))
          else if (action === 'build') { const build = await buildProject(dir, 'Rebuilt from the sidebar'); await writeState(dir, build); result = build }
          else if (action === 'export') result = await exportGame(dir)
          else if (action === 'restore') result = await restoreVersion(dir, Math.trunc(Number(payload.version)))
          // The user pressed the button themselves, so no further approval is asked.
          else if (action === 'share') result = await shareGame(dir, Number(payload.minutes ?? 30))
          else if (action === 'unshare') { stopShare(dir); await writeState(dir); result = { stopped: true } }
          else return { kind: 'error', text: `Unknown action "${action}"` }
          return { kind: 'success', text: JSON.stringify(result) }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  })
}
