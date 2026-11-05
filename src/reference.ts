/**
 * Reference images: a picture the user gives so generated art follows its
 * design and style. Only images inside the session's working directory or the
 * Harness's own chat attachments are read, and only real PNG/JPEG/WebP files,
 * because the bytes are sent to the image service.
 */
import { readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, sep } from 'node:path'
import { resolveInside, sha256, StudioError } from './util.ts'

export interface ReferenceImage {
  data: Uint8Array
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  name: string
  sha256: string
  /** Came from the chat's attachments, whose stored files are named by hash rather than by the user's file name. */
  fromChat?: boolean
}

const MAX_BYTES = 20 * 1024 * 1024

function sniff(data: Uint8Array): ReferenceImage['mime'] | undefined {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length > 12 && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return undefined
}

/** Folders a reference may come from besides the working directory: the Harness's chat attachments. */
function attachmentRoots(): string[] {
  return [join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'attachments')]
}

async function inside(path: string, root: string): Promise<boolean> {
  try {
    const [real, base] = await Promise.all([realpath(path), realpath(root)])
    return real === base || real.startsWith(base + sep)
  } catch { return false }
}

export async function loadReference(cwd: string, path: string): Promise<ReferenceImage> {
  let file: string
  let fromChat = false
  if (isAbsolute(path)) {
    fromChat = !await inside(path, cwd) && (await Promise.all(attachmentRoots().map(root => inside(path, root)))).some(Boolean)
    if (!fromChat && !await inside(path, cwd)) throw new StudioError('A reference image must be in the working directory or a chat attachment', 'BAD_REFERENCE')
    file = path
  } else {
    file = resolveInside(cwd, path)
    if (!await inside(file, cwd)) throw new StudioError('A reference image must be in the working directory or a chat attachment', 'BAD_REFERENCE')
  }
  let info
  try { info = await stat(file) } catch { throw new StudioError(`Reference image not found: ${path}`, 'BAD_REFERENCE') }
  if (!info.isFile() || info.size > MAX_BYTES) throw new StudioError('A reference image must be a file under 20 MB', 'BAD_REFERENCE')
  const data = new Uint8Array(await readFile(file))
  const mime = sniff(data)
  if (mime === undefined) throw new StudioError('A reference image must be a PNG, JPEG or WebP picture', 'BAD_REFERENCE')
  if (fromChat) return { data, mime, name: `chat-attachment.${mime.split('/')[1]!.replace('jpeg', 'jpg')}`, sha256: sha256(data), fromChat }
  return { data, mime, name: basename(file), sha256: sha256(data) }
}
