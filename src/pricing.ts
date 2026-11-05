/**
 * What image generation costs, so the user can approve a spend before it
 * happens and see what a project has spent so far. Prices are OpenAI's list
 * prices (USD per million tokens) as of 2026-11; output-token counts per image
 * were measured with gpt-image-2.5-flare on 2026-11-03.
 */
const OPENAI_PRICES: Record<string, { textIn: number; imageIn: number; imageOut: number }> = {
  'gpt-image-2.5-flare': { textIn: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-2.5-sunburst': { textIn: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-2': { textIn: 5, imageIn: 8, imageOut: 30 },
}

/** Measured image-output tokens per image; `wide` is 1536x1024. Medium wide is scaled from the low ratio. */
const OUTPUT_TOKENS: Record<string, { square: number; wide: number }> = {
  low: { square: 196, wide: 158 },
  medium: { square: 439, wide: 354 },
}

/** A prompt runs about 240 text tokens per image request. */
const PROMPT_TOKENS = 240
/** A reference picture adds about 940 image-input tokens to every request (measured with a 1024x1024 PNG). */
const REFERENCE_TOKENS = 940

export function openaiCost(model: string, usage: { inputTokens: number; outputTokens: number } | null): number | null {
  const price = OPENAI_PRICES[model]
  if (price === undefined || usage === null) return null
  return (usage.inputTokens * price.textIn + usage.outputTokens * price.imageOut) / 1_000_000
}

/** Expected cost of `count` images, or null when the quality or model has no measurement yet. */
export function estimateOpenaiCost(model: string, quality: string, wide: boolean, count: number, withReference = false): number | null {
  const price = OPENAI_PRICES[model]
  const tokens = OUTPUT_TOKENS[quality]
  if (price === undefined || tokens === undefined) return null
  const perImage = (PROMPT_TOKENS * price.textIn + (withReference ? REFERENCE_TOKENS * price.imageIn : 0)
    + (wide ? tokens.wide : tokens.square) * price.imageOut) / 1_000_000
  return perImage * count
}

export function formatUsd(value: number): string {
  return value < 0.01 ? '<$0.01' : `$${value.toFixed(2)}`
}
