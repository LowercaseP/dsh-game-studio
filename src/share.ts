/**
 * Play on a phone: a temporary, read-only link on the local network that
 * serves exactly one file, the project's latest build, behind a random token,
 * with a QR code to scan. It stops by itself after a set time, when asked, or
 * when the plugin unloads. Nothing else on the computer is reachable through it.
 */
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import qrcode from 'qrcode-generator'
import { paths } from './project.ts'
import { StudioError } from './util.ts'

export interface ShareInfo {
  url: string
  /** QR code of the url as an SVG document. */
  qrSvg: string
  expiresAt: string
}

interface Share extends ShareInfo { server: Server; timer: NodeJS.Timeout }

const shares = new Map<string, Share>()

/** This computer's address on the local network (Wi-Fi or Ethernet), preferring private ranges. */
export function lanAddress(): string | undefined {
  const candidates: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) candidates.push(entry.address)
    }
  }
  const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(ip)
  return candidates.find(isPrivate) ?? candidates[0]
}

function qrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
}

export function shareInfo(dir: string): ShareInfo | null {
  const share = shares.get(dir)
  return share ? { url: share.url, qrSvg: share.qrSvg, expiresAt: share.expiresAt } : null
}

export function stopShare(dir: string): boolean {
  const share = shares.get(dir)
  if (!share) return false
  shares.delete(dir)
  clearTimeout(share.timer)
  share.server.closeAllConnections()
  share.server.close()
  return true
}

export function stopAllShares(): void {
  for (const dir of [...shares.keys()]) stopShare(dir)
}

/** Start (or restart) sharing a project's latest build for `minutes`; `host` is for tests. */
export async function startShare(dir: string, minutes: number, host = lanAddress()): Promise<ShareInfo> {
  if (host === undefined) throw new StudioError('This computer has no local network address; connect to Wi-Fi first.', 'NO_NETWORK')
  try { await readFile(paths.artifact(dir)) } catch { throw new StudioError('Build the game before sharing it.', 'NO_BUILD') }
  stopShare(dir)
  const token = randomBytes(18).toString('base64url')
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    if (req.url === `/${token}`) { res.writeHead(302, { location: `/${token}/` }).end(); return }
    if (req.url !== `/${token}/`) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return }
    // Read on every request so a rebuild shows up on the phone after a refresh.
    readFile(paths.artifact(dir)).then((html) => {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    }, () => { res.writeHead(404).end() })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, () => { server.off('error', reject); resolve() })
  })
  const port = (server.address() as { port: number }).port
  const ttl = Math.min(240, Math.max(1, Math.round(minutes))) * 60_000
  const url = `http://${host}:${port}/${token}/`
  const share: Share = {
    url, qrSvg: qrSvg(url), expiresAt: new Date(Date.now() + ttl).toISOString(), server,
    timer: setTimeout(() => { stopShare(dir) }, ttl),
  }
  share.timer.unref()
  shares.set(dir, share)
  return shareInfo(dir)!
}
