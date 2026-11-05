/**
 * Codex generation runs: several `codex exec` image runs for one slot, in
 * parallel, each stored as a candidate the moment it finishes so the sidebar
 * fills in while the rest are still drawing.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  addCandidate, reserveNumbers, variantPrompt, writeJobRecord, writeState, type CandidateMeta, type Generation, type JobRecord,
} from './assets.ts'
import { paths } from './project.ts'
import { codexGenerate, type CodexEffort } from './providers/codex.ts'
import type { ReferenceImage } from './reference.ts'

export interface CodexBatch {
  command: string
  count: number
  model?: string
  effort?: CodexEffort
  timeoutMs: number
  reference?: ReferenceImage
}

export interface BatchResult {
  candidates: CandidateMeta[]
  errors: string[]
  status: 'completed' | 'failed' | 'killed'
}

export async function runCodexBatch(
  dir: string, generation: Generation, batch: CodexBatch, jobId: string, signal: AbortSignal, progress?: (line: string) => void,
): Promise<BatchResult> {
  const numbers = await reserveNumbers(dir, generation.slot, batch.count)
  const record: JobRecord = {
    id: jobId, slot: generation.slot, provider: 'codex', count: batch.count, done: 0, failed: 0,
    status: 'running', startedAt: new Date().toISOString(), hostPid: process.pid,
    prompt: generation.prompt,
    runs: numbers.map((number, index) => ({ run: `${jobId}-${index + 1}`, number, fullPrompt: variantPrompt(generation, index, batch.count) })),
    ...(batch.reference ? { reference: { name: batch.reference.name, sha256: batch.reference.sha256 } } : {}),
  }
  let saving: Promise<unknown> = Promise.resolve()
  const save = () => {
    const snapshot = { ...record }
    saving = saving.then(async () => { await writeJobRecord(dir, snapshot); await writeState(dir) })
    return saving
  }
  await save()
  progress?.(`0/${batch.count}`)
  const candidates: CandidateMeta[] = []
  const errors: string[] = []
  await Promise.all(Array.from({ length: batch.count }, async (_, index) => {
    const run = record.runs![index]!
    const workDir = paths.codexRun(dir, run.run)
    const fullPrompt = run.fullPrompt
    const referenceFile = batch.reference ? `reference.${batch.reference.mime.split('/')[1]!.replace('jpeg', 'jpg')}` : undefined
    try {
      if (batch.reference && referenceFile) {
        await mkdir(workDir, { recursive: true })
        await writeFile(join(workDir, referenceFile), batch.reference.data)
      }
      const result = await codexGenerate({
        command: batch.command, workDir, prompt: fullPrompt, transparent: generation.spec.transparent,
        ...(referenceFile ? { referenceFile } : {}),
        ...(batch.model ? { model: batch.model } : {}), ...(batch.effort ? { effort: batch.effort } : {}),
        timeoutMs: batch.timeoutMs, signal,
      })
      candidates.push(await addCandidate(dir, generation, {
        image: result.image, provider: 'codex', model: 'image_gen', usage: null, fullPrompt, number: numbers[index]!, agentTokens: result.tokens, seconds: result.seconds,
        ...(batch.reference ? { reference: { name: batch.reference.name, sha256: batch.reference.sha256 } } : {}),
      }))
      record.done += 1
      run.done = true
      progress?.(`${record.done + record.failed}/${batch.count}`)
      // The run folder only held the image copy and Codex's log; failed runs keep theirs for debugging.
      await rm(workDir, { recursive: true, force: true })
    } catch (error) {
      record.failed += 1
      progress?.(`${record.done + record.failed}/${batch.count}`)
      errors.push(error instanceof Error ? error.message : String(error))
    }
    await save()
  }))
  record.status = signal.aborted ? 'killed' : candidates.length > 0 ? 'completed' : 'failed'
  record.finishedAt = new Date().toISOString()
  if (errors.length > 0) record.detail = errors[0]!.slice(0, 400)
  await save()
  return { candidates: candidates.sort((a, b) => a.number - b.number), errors, status: record.status }
}
