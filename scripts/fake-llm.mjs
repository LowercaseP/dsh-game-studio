// Zero-cost stand-in for the DeepSeek Messages API, for end-to-end checks of
// the studio tools inside a real DSH host. Point DSH at it with
//   DEEPSEEK_BASE_URL=http://127.0.0.1:<port> DEEPSEEK_API_KEY=sk-dummy
// It reads the conversation and scripts the next tool call:
//   user text containing "make"/"做"  -> game_studio_create
//   result of create                   -> game_studio_generate_asset (hero)
//   user text containing "export"/"导出" -> game_studio_export
//   anything else                      -> a short text reply
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 8891)
const project = process.env.FAKE_PROJECT ?? 'moon-garden'
const log = (...args) => console.log(new Date().toISOString(), ...args)
const SLOT_PROMPTS = {
  hero: 'a small fox explorer wearing a red scarf, carrying a tiny lantern',
  enemy: 'a grumpy little bramble creature made of thorny vines, with glowing yellow eyes',
  pickup: 'a single glowing moon flower blossom with pale petals',
  background: 'a moonlit meadow of soft short grass with a few scattered tiny flowers and pebbles',
}

function lastToolResultName(messages) {
  const last = messages.at(-1)
  if (last?.role !== 'user' || !Array.isArray(last.content)) return undefined
  const result = last.content.findLast?.(block => block.type === 'tool_result')
  if (!result) return undefined
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue
    const use = message.content.find(block => block.type === 'tool_use' && block.id === result.tool_use_id)
    if (use) return { name: use.name, isError: result.is_error === true }
  }
  return undefined
}

/** Every text block of the last user message; the Harness adds context blocks (time, environment) around what the person typed. */
function lastUserText(messages) {
  const last = messages.at(-1)
  if (last?.role !== 'user') return ''
  if (typeof last.content === 'string') return last.content
  return last.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
}

function decide(body) {
  const messages = body.messages ?? []
  const tools = new Set((body.tools ?? []).map(tool => tool.name))
  const previous = lastToolResultName(messages)
  if (previous?.name === 'game_studio_create' && !previous.isError && tools.has('game_studio_generate_asset')) {
    return { tool: 'game_studio_generate_asset', input: { path: project, slot: 'hero', prompt: 'a small fox explorer wearing a red scarf', count: 2, quality: 'low' } }
  }
  if (previous) return { text: `(fake) ${previous.name} ${previous.isError ? 'failed' : 'done'}.` }
  const text = lastUserText(messages)
  log('user text', JSON.stringify(text.slice(0, 120)))
  if (/^(make|做)/imu.test(text) && tools.has('game_studio_create')) {
    return { tool: 'game_studio_create', input: { path: project, title: '月光花园', style: 'soft watercolor storybook, warm night palette' } }
  }
  if (/^(export|导出)/imu.test(text) && tools.has('game_studio_export')) return { tool: 'game_studio_export', input: { path: project } }
  if (/^(build|构建)/imu.test(text) && tools.has('game_studio_build')) return { tool: 'game_studio_build', input: { path: project } }
  // "gen <slot> [count] [quality] [provider]", e.g. "gen background 1 low" or "gen enemy 1 codex"
  // — real image spend, so the person types it.
  const gen = /^(?:gen|generate|生成)\s+(hero|enemy|pickup|background)\b(.*)$/imu.exec(text)
  if (gen && tools.has('game_studio_generate_asset')) {
    const words = gen[2].trim().split(/\s+/u)
    const input = { path: project, slot: gen[1], prompt: SLOT_PROMPTS[gen[1]], count: 2, quality: 'low' }
    for (const word of words) {
      if (/^\d$/u.test(word)) input.count = Number(word)
      else if (['low', 'medium', 'high'].includes(word)) input.quality = word
      else if (['openai', 'codex'].includes(word)) input.provider = word
    }
    return { tool: 'game_studio_generate_asset', input }
  }
  if (/^(apply|应用)/imu.test(text)) {
    const id = /([a-z0-9]+-[a-f0-9]{6})/u.exec(text)?.[1]
    if (id) return { tool: 'game_studio_apply_asset', input: { path: project, slot: 'hero', candidate: id } }
  }
  return { text: `(fake) tools available: ${[...tools].filter(name => name.startsWith('game_studio')).join(', ') || 'none from game studio'}` }
}

function sse(res, events) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  res.end()
}

const server = createServer((req, res) => {
  let raw = ''
  req.on('data', chunk => { raw += chunk })
  req.on('end', () => {
    log(req.method, req.url)
    if (req.method === 'GET' && req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash', object: 'model', owned_by: 'deepseek' }] }))
      return
    }
    if (req.method !== 'POST' || !req.url.endsWith('/messages')) { res.writeHead(404).end(); return }
    let body
    try { body = JSON.parse(raw) } catch { res.writeHead(400).end(); return }
    const plan = decide(body)
    log('decide', JSON.stringify(plan))
    const id = `msg_${Date.now()}`
    const start = { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } }
    if (plan.tool) {
      const toolId = `toolu_${Date.now()}`
      sse(res, [
        start,
        { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: toolId, name: plan.tool, input: {} } },
        { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(plan.input) } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 20 } },
        { type: 'message_stop' },
      ])
    } else {
      sse(res, [
        start,
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: plan.text } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
        { type: 'message_stop' },
      ])
    }
  })
})
server.listen(port, '127.0.0.1', () => log(`fake DeepSeek Messages API on http://127.0.0.1:${port}`))
