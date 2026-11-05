/**
 * PNG checks and sprite fitting in pure JS (pngjs), so the plugin installs
 * without native image libraries.
 */
import { PNG } from 'pngjs'
import { num } from './util.ts'

export interface Raster { width: number; height: number; data: Uint8Array }

export interface SpriteChecks {
  width: number
  height: number
  /** The file carries an alpha channel with real transparency. */
  hasAlpha: boolean
  /** Share of pixels that are (almost) fully transparent. */
  transparentRatio: number
  /** Share of the outer border ring that is opaque; a cut-out sprite keeps this near 0. */
  edgeOpaqueRatio: number
  /** Opaque bounding box as a share of the canvas area. */
  subjectCoverage: number
  /** Opaque bounding box in source pixels. */
  bbox: { x: number; y: number; w: number; h: number }
  pass: boolean
  problems: string[]
}

const ALPHA_SOLID = 16

export function decodePng(buffer: Uint8Array): Raster {
  const png = PNG.sync.read(Buffer.from(buffer))
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) }
}

export function encodePng(raster: Raster): Uint8Array {
  const png = new PNG({ width: raster.width, height: raster.height })
  png.data = Buffer.from(raster.data.buffer, raster.data.byteOffset, raster.data.length)
  return new Uint8Array(PNG.sync.write(png, { colorType: 6 }))
}

/** Inspect a would-be transparent sprite. */
export function checkSprite(raster: Raster): SpriteChecks {
  const { width, height, data } = raster
  let transparent = 0
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]!
      if (a < ALPHA_SOLID) { transparent++; continue }
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.01))
  let edge = 0, edgeOpaque = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= ring && y >= ring && x < width - ring && y < height - ring) continue
      edge++
      if (data[(y * width + x) * 4 + 3]! >= ALPHA_SOLID) edgeOpaque++
    }
  }
  const total = width * height
  const empty = maxX < 0
  const bbox = empty ? { x: 0, y: 0, w: 0, h: 0 } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  const transparentRatio = transparent / total
  const edgeOpaqueRatio = edge === 0 ? 0 : edgeOpaque / edge
  const subjectCoverage = (bbox.w * bbox.h) / total
  const problems: string[] = []
  if (transparentRatio < 0.05) problems.push('no real transparency: the background is opaque')
  if (edgeOpaqueRatio > 0.04) problems.push('subject touches or bleeds past the image edge')
  if (empty) problems.push('image is empty')
  else if (subjectCoverage < 0.04) problems.push('subject is too small in the frame')
  return {
    width, height,
    hasAlpha: transparentRatio > 0,
    transparentRatio: num(transparentRatio),
    edgeOpaqueRatio: num(edgeOpaqueRatio),
    subjectCoverage: num(subjectCoverage),
    bbox,
    pass: problems.length === 0,
    problems,
  }
}

/**
 * Crop to the opaque subject, scale it into a square of `size` with `padding`
 * share left free on each side, and centre it. Downscaling averages
 * premultiplied colour so cut-out edges do not pick up dark fringes.
 */
export function fitSprite(raster: Raster, size: number, padding = 0.06): Raster {
  const checks = checkSprite(raster)
  const box = checks.bbox.w > 0 ? checks.bbox : { x: 0, y: 0, w: raster.width, h: raster.height }
  const inner = Math.max(1, Math.round(size * (1 - padding * 2)))
  const scale = Math.min(inner / box.w, inner / box.h)
  const outW = Math.max(1, Math.round(box.w * scale))
  const outH = Math.max(1, Math.round(box.h * scale))
  const scaled = resample(raster, box, outW, outH)
  const out = new Uint8Array(size * size * 4)
  const offX = Math.floor((size - outW) / 2)
  const offY = Math.floor((size - outH) / 2)
  for (let y = 0; y < outH; y++) {
    out.set(scaled.subarray(y * outW * 4, (y + 1) * outW * 4), ((y + offY) * size + offX) * 4)
  }
  return { width: size, height: size, data: out }
}

/** Area-average resample of a source rectangle with premultiplied alpha. */
/** Shrink a raster to at most `maxWidth` pixels wide, keeping its aspect ratio. */
export function shrinkToWidth(raster: Raster, maxWidth: number): Raster {
  if (raster.width <= maxWidth) return raster
  const height = Math.max(1, Math.round(raster.height * maxWidth / raster.width))
  return { width: maxWidth, height, data: resample(raster, { x: 0, y: 0, w: raster.width, h: raster.height }, maxWidth, height) }
}

function resample(src: Raster, box: { x: number; y: number; w: number; h: number }, outW: number, outH: number): Uint8Array {
  const out = new Uint8Array(outW * outH * 4)
  const sx = box.w / outW
  const sy = box.h / outH
  for (let oy = 0; oy < outH; oy++) {
    const y0 = box.y + oy * sy
    const y1 = y0 + sy
    for (let ox = 0; ox < outW; ox++) {
      const x0 = box.x + ox * sx
      const x1 = x0 + sx
      let r = 0, g = 0, b = 0, a = 0, weight = 0
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        if (wy <= 0 || y >= src.height) continue
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0)
          if (wx <= 0 || x >= src.width) continue
          const w = wx * wy
          const i = (y * src.width + x) * 4
          const alpha = src.data[i + 3]! / 255
          r += src.data[i]! * alpha * w
          g += src.data[i + 1]! * alpha * w
          b += src.data[i + 2]! * alpha * w
          a += alpha * w
          weight += w
        }
      }
      const o = (oy * outW + ox) * 4
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
      out[o + 3] = weight > 0 ? Math.round((a / weight) * 255) : 0
    }
  }
  return out
}

/** Width and height from a JPEG's first start-of-frame marker, without decoding. */
export function jpegSize(buffer: Uint8Array): { width: number; height: number } | undefined {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined
  let i = 2
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue }
    const marker = buffer[i + 1]!
    const length = (buffer[i + 2]! << 8) | buffer[i + 3]!
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (buffer[i + 5]! << 8) | buffer[i + 6]!, width: (buffer[i + 7]! << 8) | buffer[i + 8]! }
    }
    i += 2 + length
  }
  return undefined
}
