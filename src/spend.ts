/**
 * Asking before spending: every generation shows the user which service it
 * uses, how many images, and what it should cost, through the Harness's own
 * approval prompt, and goes on only on an explicit yes. With nobody to ask it
 * fails closed instead of spending silently.
 */
import { estimateOpenaiCost, formatUsd } from './pricing.ts'
import { StudioError } from './util.ts'

export interface SpendPlan {
  provider: 'openai' | 'codex'
  /** OpenAI image model; ignored for Codex. */
  model: string
  label: string
  /** Backgrounds are wide images and cost a little less. */
  wide: boolean
  count: number
  quality: string
  /** Name of the user's reference picture, when the art should follow one. */
  reference?: string
  /** The reference is a picture the user attached in chat (its stored name means nothing to them). */
  referenceFromChat?: boolean
}

export interface SpendNotice { en: string; zh: string }

export function spendNotice(plan: SpendPlan): SpendNotice {
  const notice = baseNotice(plan)
  if (!plan.reference) return notice
  if (plan.referenceFromChat) {
    return {
      en: `${notice.en} Following the image you attached in chat, which is sent to the service.`,
      zh: `${notice.zh} 按你在聊天里附上的图来画，这张图会发给生图服务。`,
    }
  }
  return {
    en: `${notice.en} Following your reference image "${plan.reference}", which is sent to the service.`,
    zh: `${notice.zh} 按参考图「${plan.reference}」来画，这张图会发给生图服务。`,
  }
}

function baseNotice(plan: SpendPlan): SpendNotice {
  const { count, label } = plan
  const plural = count === 1 ? 'image' : 'images'
  if (plan.provider === 'openai') {
    // Each candidate is its own request, and each request carries the reference picture.
    const estimate = estimateOpenaiCost(plan.model, plan.quality, plan.wide, count, plan.reference !== undefined)
    const cost = estimate === null ? 'priced by OpenAI per token (no estimate for this quality yet)' : `about ${formatUsd(estimate)}`
    const costZh = estimate === null ? '按 OpenAI token 计费（这个质量档还没有估价）' : `预计约 ${formatUsd(estimate)}`
    return {
      en: `Generate ${count} "${label}" ${plural} with OpenAI ${plan.model} (${plan.quality}): ${cost}, billed to your OpenAI key; usually under a minute.`,
      zh: `用 OpenAI ${plan.model} 生成 ${count} 张「${label}」（${plan.quality}）：${costZh}，从你的 OpenAI key 扣费，通常 1 分钟内完成。`,
    }
  }
  return {
    en: `Generate ${count} "${label}" ${plural} with your Codex CLI: uses your Codex plan (roughly 35-50k Codex tokens per image), `
      + 'about 2-3 minutes each, in the background.',
    zh: `用你的 Codex CLI 生成 ${count} 张「${label}」：消耗你的 Codex 额度（每张约 3.5–5 万 token），每张约 2–3 分钟，后台进行。`,
  }
}

const NOBODY = 'Ask the user in chat first; to generate without asking, set the plugin option confirmSpending to false.'
const NOBODY_SHARE = 'Ask the user to press "Play on phone" in the Game Studio sidebar instead.'

/** The Harness approval service, as far as this plugin uses it. */
export interface Approval {
  request(request: Record<string, unknown>): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable' | string>
}

export function askToSpend(approval: Approval | undefined, exec: any, toolName: string, notice: SpendNotice): Promise<void> {
  return askUser(approval, exec, toolName, notice, 'spend')
}

/** The same yes-or-stop gate for opening a link on the local network. */
export function askToShare(approval: Approval | undefined, exec: any, toolName: string, notice: SpendNotice): Promise<void> {
  return askUser(approval, exec, toolName, notice, 'share')
}

async function askUser(approval: Approval | undefined, exec: any, toolName: string, notice: SpendNotice, kind: 'spend' | 'share'): Promise<void> {
  const fallback = kind === 'spend' ? NOBODY : NOBODY_SHARE
  if (approval === undefined || exec?.agent === undefined) {
    throw new StudioError(`Nobody can approve this ${kind} in this session. ${fallback}`, 'NO_APPROVAL')
  }
  const outcome = await approval.request({
    agent: exec.agent, toolName,
    ...(exec.callId !== undefined ? { callId: exec.callId } : {}),
    reason: notice.en, displayReason: notice, signal: exec.signal,
  })
  if (outcome === 'allowed-once') return
  if (outcome === 'rejected') throw new StudioError(`The user declined: ${notice.en} Ask what they would like instead.`, 'DECLINED')
  if (outcome === 'cancelled') throw new StudioError('This was cancelled before it started.', 'CANCELLED')
  throw new StudioError(`Nobody could approve this ${kind} (no approval prompt, or the approval policy is "never"). ${fallback}`, 'NO_APPROVAL')
}
