/**
 * OpenAI GPT Image provider. Chosen first because it returns native
 * transparent PNGs, which game sprites need. Requests honour HTTPS_PROXY /
 * HTTP_PROXY / NO_PROXY for this provider only, without changing how the rest
 * of the Harness process reaches the network.
 */
import { EnvHttpProxyAgent, FormData, fetch as proxyFetch } from 'undici'
import type { ReferenceImage } from '../reference.ts'
import { StudioError } from '../util.ts'

export interface ImageRequest {
  apiKey: string
  baseUrl?: string
  model: string
  prompt: string
  size: string
  background: 'transparent' | 'opaque'
  format: 'png' | 'jpeg'
  quality: 'low' | 'medium' | 'high' | 'auto'
  n: number
  /** A picture to follow; sent to the image-edit endpoint instead of plain generation. */
  reference?: ReferenceImage
  signal: AbortSignal
}

export interface ImageResponse {
  images: Uint8Array[]
  model: string
  usage: { inputTokens: number; outputTokens: number } | null
}

export const OPENAI_DEFAULT_MODEL = 'gpt-image-2.5-flare'

let agent: EnvHttpProxyAgent | undefined

/** The proxy variable undici's EnvHttpProxyAgent uses for an https request (it never reads ALL_PROXY). */
function proxyVariable(): string | undefined {
  return ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'].find(name => (process.env[name] ?? '').length > 0)
}

/** Dropped or refused connections, where no answer came back; worth one more try. */
const TRANSIENT = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'])
const RETRY_DELAY_MS = 1500

function networkHint(base: string, code: string, retried: boolean): string {
  const proxy = proxyVariable()
  const again = retried ? ', also on a second try' : ''
  if (proxy !== undefined) {
    return `Could not reach the image service at ${base} through the proxy in ${proxy} (${code}${again}). `
      + 'The proxy or the network dropped the connection; nothing was generated, so trying again in a moment is safe.'
  }
  const allProxy = ['ALL_PROXY', 'all_proxy'].some(name => (process.env[name] ?? '').length > 0)
  return `Could not reach the image service at ${base} (${code}${again}). `
    + (allProxy ? 'ALL_PROXY is not used for this request; if this network needs a proxy, start DSH with HTTPS_PROXY set.'
      : 'If this network needs a proxy, start DSH with HTTPS_PROXY set.')
}

export async function openaiGenerate(request: ImageRequest): Promise<ImageResponse> {
  const base = (request.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/u, '')
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    background: request.background,
    output_format: request.format,
    quality: request.quality,
    n: request.n,
  }
  if (request.format === 'jpeg') body.output_compression = 82
  let endpoint = `${base}/images/generations`
  let init: { method: string; headers: Record<string, string>; body: string | FormData; signal: AbortSignal }
  if (request.reference) {
    // Same fields as multipart form data, plus the reference picture.
    endpoint = `${base}/images/edits`
    const form = new FormData()
    for (const [key, value] of Object.entries(body)) form.append(key, String(value))
    form.append('image[]', new Blob([request.reference.data as BlobPart], { type: request.reference.mime }), request.reference.name)
    init = { method: 'POST', headers: { authorization: `Bearer ${request.apiKey}` }, body: form, signal: request.signal }
  } else {
    init = {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${request.apiKey}` },
      body: JSON.stringify(body),
      signal: request.signal,
    }
  }
  let response: Awaited<ReturnType<typeof proxyFetch>> | undefined
  for (let attempt = 1; response === undefined; attempt += 1) {
    try {
      if (proxyVariable() !== undefined) {
        agent ??= new EnvHttpProxyAgent()
        response = await proxyFetch(endpoint, { ...init, dispatcher: agent })
      } else {
        response = await proxyFetch(endpoint, init)
      }
    } catch (error) {
      if (request.signal.aborted) throw error
      const cause = (error as { cause?: { code?: string; message?: string } }).cause
      const code = cause?.code ?? cause?.message ?? (error as Error).message
      if (attempt === 1 && cause?.code !== undefined && TRANSIENT.has(cause.code)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        if (request.signal.aborted) throw error
        continue
      }
      throw new StudioError(networkHint(base, code, attempt > 1), 'NETWORK')
    }
  }
  const text = await response.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = undefined }
  if (!response.ok) {
    const message = json?.error?.message ?? text.slice(0, 300)
    throw new StudioError(`OpenAI image request failed (${response.status}): ${message}`, response.status === 401 ? 'AUTH' : 'PROVIDER')
  }
  const data: unknown[] = Array.isArray(json?.data) ? json.data : []
  const images = data.flatMap((item: any) => typeof item?.b64_json === 'string' ? [new Uint8Array(Buffer.from(item.b64_json, 'base64'))] : [])
  if (images.length === 0) throw new StudioError('OpenAI returned no image data', 'PROVIDER')
  const usage = json?.usage
  return {
    images,
    model: typeof json?.model === 'string' ? json.model : request.model,
    usage: usage && Number.isFinite(usage.input_tokens) && Number.isFinite(usage.output_tokens)
      ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
      : null,
  }
}
