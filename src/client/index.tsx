/**
 * Browser half of dsh-game-studio: the right-sidebar "Game Studio" tab that
 * plays the built game in an isolated iframe and lets the user compare, apply
 * and revert generated art; plus compact chat rows for the studio tools that
 * open the tab when a call finishes.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { en, NS, zh, type Key } from './locales.ts'
import { dimensionCounts, scanShelf, viewGames, type Listing, type ShelfFilter, type ShelfGame, type ShelfSort } from './shelf.ts'

const ID = '@zseven-w/dsh-game-studio'
const KIND = 'game-studio'
const SHELF_ID = '@zseven-w/dsh-game-studio/shelf'
const SHELF_KIND = 'game-studio-shelf'
const ADDRESS_PREFIX = 'dsh-resource://game-studio/session/'
const TOOLS = ['game_studio_create', 'game_studio_build', 'game_studio_generate_asset', 'game_studio_apply_asset', 'game_studio_revert_asset', 'game_studio_export']

type T = (key: Key, params?: Record<string, string>) => string

export function studioAddress(sessionId: string, project: string): string {
  return `${ADDRESS_PREFIX}${encodeURIComponent(sessionId)}/${encodeURIComponent(project)}`
}

export function parseStudioAddress(address: string): { sessionId: string; project: string } | undefined {
  if (!address.startsWith(ADDRESS_PREFIX)) return undefined
  const [session, project, extra] = address.slice(ADDRESS_PREFIX.length).split('/')
  if (!session || !project || extra !== undefined) return undefined
  try { return { sessionId: decodeURIComponent(session), project: decodeURIComponent(project) } } catch { return undefined }
}

function baseName(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path
}

function join(dir: string, file: string): string {
  return `${dir.replace(/[\\/]+$/u, '')}/${file}`
}

/** Tool rows tell open tabs to reload when a studio call finishes. */
const refreshBus = new EventTarget()
function announceRefresh(project: string): void {
  refreshBus.dispatchEvent(new CustomEvent('refresh', { detail: project }))
}

// ---------------------------------------------------------------- styles

const tok = {
  text: 'var(--dsw-alias-label-primary, inherit)',
  muted: 'var(--dsw-alias-label-secondary, #888)',
  border: 'var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
  layer: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.08))',
  active: 'var(--dsw-alias-interactive-bg-active, rgba(128,128,128,.18))',
  danger: 'var(--dsw-alias-label-danger, #d33)',
}

const s: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: tok.text, fontSize: 13 },
  bar: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${tok.border}`, flexWrap: 'wrap' },
  title: { fontWeight: 600, marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  button: { font: 'inherit', fontSize: 12, padding: '3px 9px', borderRadius: 6, border: `1px solid ${tok.border}`, background: 'transparent', color: 'inherit', cursor: 'pointer' },
  stage: { position: 'relative', flex: '1 1 55%', minHeight: 200, background: '#000' },
  frame: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' },
  hint: { padding: '6px 10px', color: tok.muted, fontSize: 12, borderBottom: `1px solid ${tok.border}` },
  error: { padding: '6px 10px', color: tok.danger, fontSize: 12, borderBottom: `1px solid ${tok.border}` },
  panel: { flex: '1 1 45%', overflow: 'auto', padding: '8px 10px', minHeight: 0 },
  slot: { borderTop: `1px solid ${tok.border}`, padding: '8px 0' },
  slotHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  thumbs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  thumb: { width: 76, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' },
  img: { width: 76, height: 76, objectFit: 'contain', borderRadius: 8, border: `1px solid ${tok.border}`, background: `repeating-conic-gradient(${tok.layer} 0% 25%, transparent 0% 50%) 50% / 12px 12px` },
  small: { fontSize: 11, color: tok.muted },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 },
}

// ---------------------------------------------------------------- files

type ReadBytes = (sessionId: string, path: string, signal: AbortSignal) => Promise<{ data: Uint8Array }>
type RunCommand = (sessionId: string, input: string) => Promise<{ ok: boolean; text: string }>

interface StudioState {
  title: string
  orientation?: 'portrait' | 'landscape'
  build: { buildId: string; bytes: number; artifact: string } | null
  slots: Record<string, {
    label: string
    file: string
    transparent: boolean
    history: number
    record: { source: string; provider?: string; model?: string; prompt?: string } | null
    candidates: Array<{ id: string; number?: number; file: string; prompt: string; pass: boolean; problems: string[] }>
  }>
  spend?: { openaiImages: number; openaiUsd: number; codexImages: number; codexTokens: number }
  jobs?: JobRecord[]
  versions?: Array<{ number: number; note: string; createdAt: string; buildId: string }>
  share?: { url: string; qrSvg: string; expiresAt: string } | null
}

function clock(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

interface JobRecord {
  id: string
  slot: string
  provider: string
  count: number
  done: number
  failed: number
  status: 'running' | 'completed' | 'failed' | 'killed' | 'interrupted'
  startedAt: string
  detail?: string
  recovered?: number
}

/** How often the tab re-reads the studio state while background generation runs. */
const POLL_MS = 3000

function elapsed(since: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function providerName(provider: string): string {
  return provider === 'codex' ? 'Codex' : provider === 'openai' ? 'OpenAI' : provider
}

function sourceLabel(record: StudioState['slots'][string]['record'], t: T): string {
  if (record === null) return ''
  if (record.source === 'generated') return `${providerName(record.provider ?? '')} · ${record.model ?? ''}`
  if (record.source === 'template') return t('tab.sourceTemplate')
  if (record.source === 'edited') return t('tab.sourceEdited')
  return record.source
}

function spendLine(spend: StudioState['spend'], t: T): string {
  if (spend === undefined || spend.openaiImages + spend.codexImages === 0) return ''
  const parts: string[] = []
  if (spend.openaiImages > 0) {
    parts.push(t('tab.spendOpenai', { count: String(spend.openaiImages), usd: spend.openaiUsd < 0.01 ? '<$0.01' : `$${spend.openaiUsd.toFixed(2)}` }))
  }
  if (spend.codexImages > 0) parts.push(t('tab.spendCodex', { count: String(spend.codexImages) }))
  return t('tab.spend', { parts: parts.join(' · ') })
}

function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

/** Blob URL for one workspace file, revoked when the path or key changes or the view unmounts. */
function useFileUrl(readBytes: ReadBytes, sessionId: string, path: string | undefined, version: number | string, type?: string): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (path === undefined) { setUrl(undefined); return }
    const controller = new AbortController()
    let created: string | undefined
    readBytes(sessionId, path, controller.signal).then((file) => {
      if (controller.signal.aborted) return
      created = URL.createObjectURL(new Blob([file.data as BlobPart], { type: type ?? mimeOf(path) }))
      setUrl(created)
    }).catch(() => { if (!controller.signal.aborted) setUrl(undefined) })
    return () => { controller.abort(); if (created) URL.revokeObjectURL(created) }
  }, [readBytes, sessionId, path, version, type])
  return url
}

// ---------------------------------------------------------------- tab body

interface TabInjected { readBytes: ReadBytes; runCommand: RunCommand }

function Thumb({ readBytes, sessionId, path, version, children, title, src }: {
  readBytes: ReadBytes; sessionId: string; path: string; version: number; children?: ReactNode; title?: string
  /** An image to show instead of the file, e.g. the game's own render of a code-drawn character. */
  src?: string
}) {
  const fileUrl = useFileUrl(readBytes, sessionId, src === undefined ? path : undefined, version)
  const url = src ?? fileUrl
  return <div style={s.thumb} title={title}>
    {url ? <img src={url} alt="" style={s.img} /> : <div style={s.img} />}
    {children}
  </div>
}

function StudioTab(props: any): ReactNode {
  const { useTabInfo, t, readBytes, runCommand } = props as { useTabInfo: () => any; t: T } & TabInjected
  const { tab } = useTabInfo()
  const target = useMemo(() => parseStudioAddress(tab.contentId), [tab.contentId])
  if (target === undefined) throw new Error(`dsh-game-studio: not a studio address "${tab.contentId}"`)
  const { sessionId, project } = target
  const [version, setVersion] = useState(0)
  // State-only refreshes while background jobs run; they must not restart the game.
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<StudioState | null>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string }>()
  const [game, setGame] = useState<{ phase: string; score: number }>()
  // Close-ups the running build drew of its code-drawn characters, by slot.
  const [renders, setRenders] = useState<Record<string, string>>({})
  const frame = useRef<HTMLIFrameElement>(null)

  const reload = useCallback(() => { setVersion(value => value + 1) }, [])

  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent).detail === project) reload() }
    refreshBus.addEventListener('refresh', listener)
    return () => { refreshBus.removeEventListener('refresh', listener) }
  }, [project, reload])

  useEffect(() => {
    const controller = new AbortController()
    readBytes(sessionId, join(project, '.studio/state.json'), controller.signal)
      .then(file => { if (!controller.signal.aborted) setState(JSON.parse(new TextDecoder().decode(file.data)) as StudioState) })
      .catch(() => { if (!controller.signal.aborted) setState(null) })
    return () => { controller.abort() }
  }, [readBytes, sessionId, project, version, tick])

  const running = state?.jobs?.some(job => job.status === 'running') ?? false
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => { setTick(value => value + 1) }, POLL_MS)
    return () => { clearInterval(timer) }
  }, [running])

  // The game reloads on an explicit reload or a new build, not on every state poll.
  const gameUrl = useFileUrl(readBytes, sessionId, state?.build ? join(project, 'dist/index.html') : undefined,
    `${version}:${state?.build?.buildId ?? ''}`, 'text/html')
  // A reloaded build starts on its title screen; drop the previous run's phase.
  useEffect(() => { setGame(undefined); setRenders({}) }, [gameUrl])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { source?: unknown; type?: unknown; phase?: unknown; score?: unknown; message?: unknown }
      if (data?.source !== 'dsh-game-studio') return
      if (data.type === 'state' && typeof data.phase === 'string') setGame({ phase: data.phase, score: Number(data.score) || 0 })
      if (data.type === 'error' && typeof data.message === 'string') setNotice({ kind: 'error', text: t('tab.gameError', { message: data.message.slice(0, 300) }) })
      if (data.type === 'renders' && (data as { renders?: unknown }).renders && typeof (data as { renders?: unknown }).renders === 'object') {
        // Only small PNG data URLs are accepted from the sandboxed game.
        const accepted: Record<string, string> = {}
        for (const [slot, value] of Object.entries((data as { renders: Record<string, unknown> }).renders)) {
          if (typeof value === 'string' && value.startsWith('data:image/png;base64,') && value.length < 2_000_000) accepted[slot] = value
        }
        setRenders(accepted)
      }
    }
    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('message', onMessage) }
  }, [t])

  const run = useCallback(async (action: string, payload: Record<string, string>) => {
    setBusy(true)
    setNotice(undefined)
    try {
      const result = await runCommand(sessionId, `${action} ${JSON.stringify({ project, ...payload })}`)
      if (!result.ok) { setNotice({ kind: 'error', text: result.text }); return }
      if (action === 'export') {
        const file = (JSON.parse(result.text) as { file?: string }).file ?? ''
        setNotice({ kind: 'info', text: t('tab.exported', { file }) })
      }
      reload()
    } finally {
      setBusy(false)
    }
  }, [runCommand, sessionId, project, reload, t])

  const title = state?.title ?? baseName(project)
  return <div style={s.root} data-plugin="dsh-game-studio">
    <div style={s.bar}>
      <span style={s.title} title={project}>{title}</span>
      {state?.build && <span style={s.small}>{t('tab.build', { id: state.build.buildId, size: `${Math.round(state.build.bytes / 1024)} KB` })}</span>}
      <button type="button" style={s.button} onClick={reload} disabled={busy}>{t('tab.reload')}</button>
      <button type="button" style={s.button} onClick={() => { void run('build', {}) }} disabled={busy}>{t('tab.rebuild')}</button>
      <button type="button" style={s.button} onClick={() => { void run('export', {}) }} disabled={busy}>{t('tab.export')}</button>
      <button type="button" style={s.button} onClick={() => { void run('share', { minutes: '30' }) }} disabled={busy}>{t('tab.share')}</button>
    </div>
    {state?.share && Date.parse(state.share.expiresAt) > Date.now() && <div style={{ ...s.hint, display: 'flex', gap: 10, alignItems: 'center' }}>
      <img alt="" style={{ width: 112, height: 112, background: '#fff', borderRadius: 6, padding: 4, flex: 'none' }}
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.share.qrSvg)}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ color: tok.text }}>{t('tab.shareHint')}</span>
        <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{state.share.url}</code>
        <span>{t('tab.shareUntil', { time: clock(state.share.expiresAt) })}</span>
        <button type="button" style={{ ...s.button, alignSelf: 'flex-start' }} disabled={busy} onClick={() => { void run('unshare', {}) }}>{t('tab.unshare')}</button>
      </div>
    </div>}
    {notice && <div style={notice.kind === 'error' ? s.error : s.hint}>{notice.text}</div>}
    {state === undefined ? <div style={s.hint}>{t('tab.loading')}</div>
      : state === null || state.build === null ? <div style={s.hint}>{t('tab.noBuild')}</div>
        : <>
          <div style={s.hint}>{game ? t('tab.phase', { phase: game.phase, score: String(game.score) }) : t('tab.clickToPlay')}</div>
          {/* A landscape game gets a wide stage instead of a tall strip it would letterbox into. */}
          <div style={state.orientation === 'landscape' ? { ...s.stage, flex: 'none', aspectRatio: '16 / 9', minHeight: 0 } : s.stage}>
            {gameUrl && <iframe key={gameUrl} ref={frame} src={gameUrl} title={title} style={s.frame}
              sandbox="allow-scripts" allow="fullscreen" referrerPolicy="no-referrer" />}
          </div>
        </>}
    {state && <div style={s.panel}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('tab.assets')}{busy ? ` · ${t('tab.busy')}` : ''}</div>
      {spendLine(state.spend, t) && <div style={{ ...s.small, marginBottom: 4 }}>{spendLine(state.spend, t)}</div>}
      {Object.entries(state.slots).map(([slot, info]) => <div key={slot} style={s.slot}>
        <div style={s.slotHead}>
          <strong>{info.label}</strong>
          <span style={s.small}>{sourceLabel(info.record, t)}</span>
          {info.history > 0 && <button type="button" style={{ ...s.button, marginLeft: 'auto' }} disabled={busy}
            onClick={() => { void run('revert', { slot }) }}>{t('tab.revert')}</button>}
        </div>
        {(state.jobs ?? []).filter(job => job.slot === slot).slice(0, 1).map(job => <JobLine key={job.id} job={job} t={t} />)}
        <div style={s.thumbs}>
          {/* A template slot whose character the game draws in code: show what the game draws, not the template's icon file. */}
          <Thumb readBytes={readBytes} sessionId={sessionId} path={join(project, info.file)} version={version} title={info.record?.prompt}
            {...(info.record?.source === 'template' && renders[slot] ? { src: renders[slot] } : {})}>
            <span style={s.small}>{info.record?.source === 'template'
              ? (renders[slot] ? t('tab.currentRendered') : t('tab.currentTemplate'))
              : t('tab.current')}</span>
          </Thumb>
          {info.candidates.length === 0 && <span style={{ ...s.small, alignSelf: 'center' }}>{t('tab.noCandidates', { slot: info.label })}</span>}
          {info.candidates.map(candidate => <Thumb key={candidate.id} readBytes={readBytes} sessionId={sessionId}
            path={candidate.file} version={0} title={candidate.pass ? candidate.prompt : t('tab.failed', { problems: candidate.problems.join('; ') })}>
            {candidate.number !== undefined && <span style={{ ...s.small, textAlign: 'center' }}>#{candidate.number}</span>}
            <button type="button" style={s.button} disabled={busy || !candidate.pass}
              onClick={() => { void run('apply', { slot, candidate: candidate.id }) }}>{t('tab.apply')}</button>
          </Thumb>)}
        </div>
      </div>)}
      {(state.versions ?? []).length > 0 && <div style={s.slot}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('tab.versions')}</div>
        {(state.versions ?? []).map((version, index) => <div key={version.number} style={{ ...s.row, padding: '2px 0' }}>
          <span style={{ ...s.small, minWidth: 34 }}>v{version.number}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={version.note}>{version.note}</span>
          <span style={s.small}>{clock(version.createdAt)}</span>
          {index === 0
            ? <span style={{ ...s.small, minWidth: 64, textAlign: 'center' }}>{t('tab.current')}</span>
            : <button type="button" style={{ ...s.button, minWidth: 64 }} disabled={busy}
              onClick={() => { void run('restore', { version: String(version.number) }) }}>{t('tab.restore')}</button>}
        </div>)}
      </div>}
    </div>}
  </div>
}

function JobLine({ job, t }: { job: JobRecord; t: T }): ReactNode {
  const provider = providerName(job.provider)
  const detail = (job.detail ?? '').slice(0, 200)
  if (job.status === 'running') {
    return <div style={{ ...s.small, marginBottom: 6 }}>{t('tab.jobRunning', { provider, done: String(job.done), count: String(job.count), elapsed: elapsed(job.startedAt) })}</div>
  }
  if (job.status === 'interrupted' && (job.recovered ?? 0) > 0) {
    return <div style={{ ...s.small, marginBottom: 6 }}>{t(job.done < job.count ? 'tab.jobRecoveredPartial' : 'tab.jobRecovered', { provider, done: String(job.done), count: String(job.count) })}</div>
  }
  if (job.status === 'interrupted') return <div style={{ ...s.small, marginBottom: 6 }}>{t('tab.jobInterrupted', { provider })}</div>
  if (job.failed === 0) return null
  const key = job.done > 0 ? 'tab.jobPartial' : 'tab.jobFailed'
  return <div style={{ ...s.small, color: tok.danger, marginBottom: 6 }}>{t(key, { provider, failed: String(job.failed), detail })}</div>
}

// ---------------------------------------------------------------- shelf ("My games")

type ListDir = (sessionId: string, path: string, signal: AbortSignal) => Promise<Listing>
interface ShelfInjected { shelfSession: string; readBytes: ReadBytes; listDir: ListDir; runCommand: RunCommand }

const shelfStyle: Record<string, CSSProperties> = {
  // Scrolling lives on this wrapper: a height-capped grid would squeeze its rows below the tiles' aspect-ratio height.
  scroll: { flex: '1 1 auto', minHeight: 0, overflow: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gridAutoRows: 'max-content', gap: 8, padding: 10 },
  tile: { position: 'relative', display: 'block', width: '100%', aspectRatio: '4 / 3', padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', font: 'inherit', textAlign: 'left', color: '#fff', background: '#1d1f24' },
  // Character art (no playtest yet) sits whole on a soft backdrop above the caption.
  art: { position: 'absolute', inset: '8% 12% 30%', width: '76%', height: '62%', objectFit: 'contain' },
  artBackdrop: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, #3a3f4b 0%, #1d1f24 75%)' },
  shot: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 10px 8px', background: 'linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.55) 55%, rgba(0,0,0,0) 100%)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontWeight: 600, fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,.5)' },
  meta: { fontSize: 11, lineHeight: 1.3, color: 'rgba(255,255,255,.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  controls: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 0', flexWrap: 'wrap' },
  chip: { font: 'inherit', fontSize: 12, padding: '3px 11px', borderRadius: 999, border: 0, cursor: 'pointer' },
  sort: { font: 'inherit', fontSize: 12, padding: '2px 4px', border: 0, background: 'transparent', cursor: 'pointer' },
}

/** Hover and focus feedback the inline styles cannot express. */
const SHELF_CSS = `
[data-view="shelf"] .dgs-tile img { transition: transform .25s ease; }
[data-view="shelf"] .dgs-tile:hover img, [data-view="shelf"] .dgs-tile:focus-visible img { transform: scale(1.05); }
[data-view="shelf"] .dgs-tile:focus-visible { outline: 2px solid var(--dsw-alias-interactive-border-focus, #4c8bf5); outline-offset: 2px; }
[data-view="shelf"] .dgs-chip { background: var(--dsw-alias-bg-layer-1, rgba(128,128,128,.12)); color: var(--dsw-alias-label-primary, inherit); }
[data-view="shelf"] .dgs-chip[aria-pressed="true"] { background: var(--dsw-alias-label-primary, #222); color: var(--dsw-alias-bg-base, #fff); font-weight: 600; }
[data-view="shelf"] .dgs-sort { color: var(--dsw-alias-label-secondary, #888); }
[data-view="shelf"] .dgs-sort[aria-pressed="true"] { color: var(--dsw-alias-label-primary, inherit); font-weight: 600; }
`

function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ShelfCard({ game, sessionId, readBytes, t, open }: { game: ShelfGame; sessionId: string; readBytes: ReadBytes; t: T; open: (game: ShelfGame) => void }) {
  const url = useFileUrl(readBytes, sessionId, game.cover, game.updatedAt)
  // Playtest pictures fill the tile; a character picture is shown whole.
  const screenshot = game.cover !== undefined && /\.jpe?g$/iu.test(game.cover)
  const meta = [game.dimension === '3d' ? '3D' : game.dimension === '2d' ? '2D' : '',
    game.built ? '' : t('shelf.notBuilt'),
    game.versions > 0 ? t('shelf.versions', { count: String(game.versions) }) : '',
    when(game.updatedAt)].filter(Boolean).join(' · ')
  return <button type="button" className="dgs-tile" style={shelfStyle.tile} onClick={() => { open(game) }} title={t('shelf.play', { title: game.title })} aria-label={t('shelf.play', { title: game.title })} data-project={game.project}>
    {!screenshot && <div style={shelfStyle.artBackdrop} />}
    {url && <img src={url} alt="" style={screenshot ? shelfStyle.shot : shelfStyle.art} />}
    <div style={shelfStyle.caption}>
      <span style={shelfStyle.name}>{game.title}</span>
      <span style={shelfStyle.meta}>{meta}</span>
    </div>
  </button>
}

function ShelfTab(props: any): ReactNode {
  const { useTabInfo, t, shelfSession, readBytes, listDir, runCommand, useSessions } = props as { useTabInfo: () => any; t: T; useSessions?: (select: (sessions: any) => unknown) => unknown } & ShelfInjected
  const { tab } = useTabInfo()
  const sessionId: string = shelfSession || props.sessionId
  const cwd = (useSessions ? useSessions(sessions => sessions?.byId?.[sessionId]?.cwd) : undefined) as string | undefined
  const [version, setVersion] = useState(0)
  const [scan, setScan] = useState<{ games: ShelfGame[]; partial: boolean }>()
  const visible = tab?.visible !== false
  const [filter, setFilter] = useState<ShelfFilter>('all')
  const [sort, setSort] = useState<ShelfSort>('recent')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string }>()

  useEffect(() => {
    const listener = () => { setVersion(value => value + 1) }
    refreshBus.addEventListener('refresh', listener)
    return () => { refreshBus.removeEventListener('refresh', listener) }
  }, [])

  useEffect(() => {
    if (!sessionId || !cwd || !visible) return
    const controller = new AbortController()
    const read = async (path: string, signal: AbortSignal) => new TextDecoder().decode((await readBytes(sessionId, path, signal)).data)
    scanShelf((path, signal) => listDir(sessionId, path, signal), read, cwd, controller.signal)
      .then(result => { if (!controller.signal.aborted) setScan(result) })
      .catch(() => { if (!controller.signal.aborted) setScan({ games: [], partial: true }) })
    return () => { controller.abort() }
  }, [sessionId, cwd, visible, version, readBytes, listDir])

  const open = useCallback((game: ShelfGame) => {
    tab.actions.openResource(studioAddress(sessionId, game.project))
  }, [tab, sessionId])

  const shown = useMemo(() => scan ? viewGames(scan.games, filter, sort) : [], [scan, filter, sort])
  const counts = useMemo(() => dimensionCounts(scan?.games ?? []), [scan])

  const exportWall = useCallback(async () => {
    setBusy(true)
    setNotice(undefined)
    try {
      // The page is written in the language the sidebar is shown in.
      const lang = t('shelf.refresh') === '刷新' ? 'zh' : 'en'
      const result = await runCommand(sessionId, `wall ${JSON.stringify({ projects: shown.map(game => game.project), lang })}`)
      if (!result.ok) { setNotice({ kind: 'error', text: t('shelf.exportFailed', { message: result.text }) }); return }
      const wall = JSON.parse(result.text) as { file: string; bytes: number; games: number; skipped: unknown[] }
      const text = t('shelf.exported', { file: wall.file, count: String(wall.games), size: `${(wall.bytes / 1048576).toFixed(1)} MB` })
      setNotice({ kind: 'info', text: wall.skipped.length > 0 ? `${text} ${t('shelf.exportSkipped', { count: String(wall.skipped.length) })}` : text })
    } finally {
      setBusy(false)
    }
  }, [runCommand, sessionId, shown, t])

  const chip = (value: ShelfFilter, label: string) => <button key={value} type="button" className="dgs-chip" aria-pressed={filter === value}
    style={shelfStyle.chip} onClick={() => { setFilter(value) }}>{label} {counts[value]}</button>
  const order = (value: ShelfSort, label: string) => <button key={value} type="button" className="dgs-sort" aria-pressed={sort === value}
    style={shelfStyle.sort} onClick={() => { setSort(value) }}>{label}</button>

  return <div style={s.root} data-plugin="dsh-game-studio" data-view="shelf">
    <style>{SHELF_CSS}</style>
    <div style={s.bar}>
      <span style={s.title}>{t('shelf.title')}</span>
      {scan && <span style={s.small}>{t('shelf.count', { count: String(shown.length) })}</span>}
      <button type="button" style={s.button} onClick={() => { setVersion(value => value + 1) }}>{t('shelf.refresh')}</button>
      {scan && scan.games.length > 0 && <button type="button" style={s.button} disabled={busy || shown.length === 0} title={t('shelf.exportHint')}
        onClick={() => { void exportWall() }}>{busy ? t('shelf.exporting') : t('shelf.export')}</button>}
    </div>
    {notice && <div style={notice.kind === 'error' ? s.error : s.hint}>{notice.text}</div>}
    {!sessionId || !cwd ? <div style={s.hint}>{t('shelf.noSession')}</div>
      : scan === undefined ? <div style={s.hint}>{t('shelf.scanning')}</div>
        : <>
          {scan.partial && <div style={s.hint}>{t('shelf.partial')}</div>}
          {scan.games.length === 0 ? <div style={{ ...s.hint, borderBottom: 0 }}>{t('shelf.empty')}</div>
            : <>
              <div style={shelfStyle.controls}>
                {chip('all', t('shelf.all'))}
                {counts['2d'] > 0 && chip('2d', '2D')}
                {counts['3d'] > 0 && chip('3d', '3D')}
                <span style={{ flex: 1 }} />
                {order('recent', t('shelf.sortRecent'))}
                {order('versions', t('shelf.sortVersions'))}
                {order('name', t('shelf.sortName'))}
              </div>
              <div style={shelfStyle.scroll}>
                <div style={shelfStyle.grid}>
                  {shown.map(game => <ShelfCard key={game.project} game={game} sessionId={sessionId} readBytes={readBytes} t={t} open={open} />)}
                </div>
              </div>
            </>}
        </>}
  </div>
}

function ShelfIcon(props: { size?: number }) {
  const size = props?.size ?? 16
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 8h10a4 4 0 0 1 4 4v2.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V12a4 4 0 0 1 4-4z" />
    <path d="M8 10.5v3M6.5 12h3" /><circle cx="15.5" cy="11.5" r=".6" fill="currentColor" /><circle cx="17" cy="13" r=".6" fill="currentColor" />
  </svg>
}

// ---------------------------------------------------------------- chat rows

interface RowInjected { openStudio: (sessionId: string, project: string) => void }

function StudioRow(props: any): ReactNode {
  const { phase, block, sessionId, t, openStudio, toolName } = props as { phase: string; block: any; sessionId: string; t: T; toolName: string } & RowInjected
  const firstPhase = useRef(phase)
  const meta = phase === 'result' ? block?.meta as { studio?: number; kind?: string; project?: string; candidates?: unknown[]; job?: string | null; provider?: string; count?: number } | undefined : undefined
  const project = meta?.studio === 1 ? meta.project : undefined
  const failed = phase === 'result' && block?.isError === true
  useEffect(() => {
    // Open the studio only for calls that finished while we watched; history replay stays quiet.
    if (phase !== 'result' || firstPhase.current === 'result' || project === undefined || failed) return
    announceRefresh(project)
    openStudio(sessionId, project)
  }, [phase, project, failed, sessionId, openStudio])
  const label = failed ? t('row.failed')
    : phase !== 'result' ? t('row.running')
      : toolName === 'game_studio_create' ? t('row.create')
        : toolName === 'game_studio_build' ? t('row.build')
          : toolName === 'game_studio_generate_asset' ? (meta?.job
            ? t('row.background', { provider: providerName(meta.provider ?? ''), count: String(meta.count ?? 0) })
            : t('row.candidates', { count: String(meta?.candidates?.length ?? 0) }))
            : toolName === 'game_studio_apply_asset' ? t('row.apply')
              : toolName === 'game_studio_revert_asset' ? t('row.revert') : t('row.export')
  const detail = failed ? (block.content ?? []).map((item: any) => item.type === 'text' ? item.text : '').join(' ').slice(0, 240) : ''
  return <div style={s.row} data-tool={toolName}>
    <span aria-hidden>🎮</span>
    <span>{label}</span>
    {detail && <span style={{ ...s.small, color: tok.danger }}>{detail}</span>}
    {project && <button type="button" style={s.button} onClick={() => { openStudio(sessionId, project) }}>{t('row.open')}</button>}
  </div>
}

// ---------------------------------------------------------------- plugin

export const inject = ['slots', 'locale', 'remote', 'remote.workspaceFiles', 'remote.commands', 'sidebarRight', 'sidebarRightTabs']

export function apply(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-game-studio: dictionaries')
  const t: T = ctx.locale.bind(NS)

  const openStudio = (sessionId: string, project: string) => {
    ctx.sidebarRight.openResource(studioAddress(sessionId, project))
  }
  // Remote calls settle as `{ ok, value }` or `{ ok: false, error }`.
  const readBytes: ReadBytes = async (sessionId, path, signal) => {
    const result = await ctx.remote.workspaceFiles.readBytes(sessionId, path, {}, signal)
    if (!result.ok) throw new Error(`${result.error?.message ?? 'read failed'} (${path})`)
    return result.value
  }
  const runCommand: RunCommand = async (sessionId, input) => {
    try {
      const result = await ctx.remote.commands.execute(sessionId, `/game-studio ${input}`, [])
      if (!result.ok) return { ok: false, text: `${result.error.message} (${result.error.code})` }
      const value = result.value?.result ?? result.value
      if (value === undefined) return { ok: false, text: 'The /game-studio command is not available in this session' }
      return { ok: value.kind === 'success', text: String(value.text ?? '') }
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) }
    }
  }

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: KIND,
    patterns: ['dsh-resource://game-studio/**'],
    priority: 'extension',
    canOpen: (address: string) => parseStudioAddress(address) !== undefined,
    title: (address: string) => {
      const target = parseStudioAddress(address)
      return t('tab.title', { name: target ? baseName(target.project) : 'game' })
    },
  }), 'dsh-game-studio: tab type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: ID, locale: NS,
    inject: (): TabInjected => ({ readBytes, runCommand }),
  }, StudioTab)), 'dsh-game-studio: tab body')

  const listDir: ListDir = async (sessionId, path, signal) => {
    const result = await ctx.remote.workspaceFiles.list(sessionId, path, signal)
    if (!result.ok) throw new Error(`${result.error?.message ?? 'list failed'} (${path})`)
    return { entries: result.value.entries ?? [], truncated: result.value.truncated === true }
  }

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: SHELF_ID,
    kind: SHELF_KIND,
    title: () => t('shelf.title'),
    guide: [{ id: 'shelf', order: 60, title: () => t('guide.title'), description: () => t('guide.description'), icon: ShelfIcon }],
  }), 'dsh-game-studio: shelf type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: SHELF_ID, locale: NS,
    inject: (sessionId: string): ShelfInjected => ({ shelfSession: typeof sessionId === 'string' ? sessionId : '', readBytes, listDir, runCommand }),
  }, ShelfTab)), 'dsh-game-studio: shelf body')

  for (const tool of TOOLS) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview', key: tool, locale: NS,
      inject: (): RowInjected => ({ openStudio }),
    }, StudioRow))
  }
}
