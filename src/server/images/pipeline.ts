import sharp, { type Metadata, type OverlayOptions, type Sharp } from 'sharp'
import type { PhotoVariant } from '../db/schema'
import { sniffImageType, type SniffedType } from './sniff'
import { creditOverlay, tiledOverlay } from './watermark'

// Keep memory predictable on small servers.
sharp.cache({ memory: 64, files: 0, items: 50 })
sharp.concurrency(2)

export class ImageError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

export type UploadLimits = {
  maxBytes: number
  minLongEdge: number
  minShortEdge: number
  maxPixels: number
}

export type Inspected = { mime: SniffedType; width: number; height: number }

const SHARP_FORMAT_TO_MIME: Record<string, SniffedType | undefined> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/avif',
}

/**
 * Validates an upload by its contents: magic bytes, a successful decode,
 * single frame, pixel budget and minimum resolution (after EXIF rotation).
 */
export async function inspectImage(buf: Buffer, limits: UploadLimits): Promise<Inspected> {
  if (buf.length === 0) throw new ImageError('file_missing')
  if (buf.length > limits.maxBytes) throw new ImageError('file_too_large')
  const mime = sniffImageType(buf)
  if (!mime) throw new ImageError('file_type')
  if (mime === 'image/heic') throw new ImageError('file_heic')

  let meta: Metadata
  try {
    meta = await sharp(buf, { limitInputPixels: limits.maxPixels, failOn: 'error' }).metadata()
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    throw new ImageError(/pixel limit/i.test(msg) ? 'file_too_many_pixels' : 'file_corrupt')
  }
  if (!meta.width || !meta.height || !meta.format) throw new ImageError('file_corrupt')
  if (SHARP_FORMAT_TO_MIME[meta.format] !== mime) throw new ImageError('file_type')
  if ((meta.pages ?? 1) > 1) throw new ImageError('file_animated')
  if (meta.width * meta.height > limits.maxPixels) throw new ImageError('file_too_many_pixels')

  const swap = (meta.orientation ?? 1) >= 5
  const width = swap ? meta.height : meta.width
  const height = swap ? meta.width : meta.height
  if (Math.max(width, height) < limits.minLongEdge || Math.min(width, height) < limits.minShortEdge) {
    throw new ImageError('resolution_too_low')
  }

  // Full decode at low resolution catches truncated / malformed files.
  try {
    await sharp(buf, { limitInputPixels: limits.maxPixels, failOn: 'error' })
      .rotate()
      .resize(64, 64, { fit: 'inside' })
      .raw()
      .toBuffer()
  } catch {
    throw new ImageError('file_corrupt')
  }
  return { mime, width, height }
}

export type RenderedOutput = Omit<PhotoVariant, 'key' | 'bytes'> & { buffer: Buffer }

export type RenderResult = {
  outputs: Array<RenderedOutput>
  blurDataUrl: string
  /** EXIF-free, downscaled JPEG used for the AI pre-check (never stored). */
  aiJpeg: Buffer
  width: number
  height: number
}

export const THUMB_WIDTHS = [480, 960, 1280] as const
export const PREVIEW_EDGES = [1080] as const

/**
 * Renders every derivative from one decoded master. sharp strips all
 * metadata (EXIF, GPS, XMP, IPTC, ICC) unless asked to keep it — we never
 * call keepMetadata/withMetadata — and `.rotate()` bakes orientation in.
 */
export async function renderDerivatives(
  original: Buffer,
  opts: { authorName: string; previewLongEdge: number; maxPixels: number },
): Promise<RenderResult> {
  const masterEdge = Math.max(2048, opts.previewLongEdge)
  const master = await sharp(original, { limitInputPixels: opts.maxPixels, failOn: 'error' })
    .rotate()
    .resize({ width: masterEdge, height: masterEdge, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const raw = { raw: { width: master.info.width, height: master.info.height, channels: master.info.channels } }
  const from = () => sharp(master.data, raw)
  const outputs: Array<RenderedOutput> = []

  async function encodeBoth(
    kind: PhotoVariant['kind'],
    pipeline: Sharp,
    overlays: (w: number, h: number) => Promise<Array<OverlayOptions>>,
  ) {
    const resized = await pipeline.raw().toBuffer({ resolveWithObject: true })
    const { width, height } = resized.info
    const composed = await sharp(resized.data, { raw: { width, height, channels: resized.info.channels } })
      .composite(await overlays(width, height))
      .raw()
      .toBuffer({ resolveWithObject: true })
    const img = () => sharp(composed.data, { raw: { width, height, channels: composed.info.channels } })
    const [avif, webp] = await Promise.all([
      img().avif({ quality: 52, effort: 3, chromaSubsampling: '4:2:0' }).toBuffer(),
      img().webp({ quality: 80, effort: 4 }).toBuffer(),
    ])
    outputs.push({ kind, width, height, format: 'avif', buffer: avif })
    outputs.push({ kind, width, height, format: 'webp', buffer: webp })
  }

  // Grid thumbnails: small corner credit.
  for (const w of THUMB_WIDTHS) {
    await encodeBoth('thumb', from().resize({ width: w, withoutEnlargement: true }), async (iw, ih) => [
      await creditOverlay(iw, ih, opts.authorName),
    ])
  }

  // Public previews: visible tiled watermark + credit, limited long edge.
  const previewEdges = [...PREVIEW_EDGES.filter((e) => e < opts.previewLongEdge), opts.previewLongEdge]
  for (const edge of previewEdges) {
    await encodeBoth(
      'preview',
      from().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }),
      async (iw, ih) => [await tiledOverlay(iw, ih, opts.authorName), await creditOverlay(iw, ih, opts.authorName)],
    )
  }

  // Open Graph card (JPEG for crawler compatibility).
  const og = await from()
    .resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ogJpeg = await sharp(og.data, { raw: { width: 1200, height: 630, channels: og.info.channels } })
    .composite([await creditOverlay(1200, 630, opts.authorName)])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer()
  outputs.push({ kind: 'og', width: 1200, height: 630, format: 'jpeg', buffer: ogJpeg })

  // Private review copy for moderators: no watermark, never public.
  const review = await from()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true })
  outputs.push({ kind: 'review', width: review.info.width, height: review.info.height, format: 'webp', buffer: review.data })

  const blur = await from().resize({ width: 24 }).webp({ quality: 30 }).toBuffer()
  const aiJpeg = await from()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()

  return {
    outputs,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    aiJpeg,
    width: master.info.width,
    height: master.info.height,
  }
}

/** Square avatar in two sizes (stored privately until approved). */
export async function renderAvatar(original: Buffer, maxPixels: number) {
  const base = sharp(original, { limitInputPixels: maxPixels, failOn: 'error' }).rotate().toColourspace('srgb')
  const [s160, s480, blur] = await Promise.all([
    base.clone().resize(160, 160, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80 }).toBuffer(),
    base.clone().resize(480, 480, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toBuffer(),
    base.clone().resize(16, 16, { fit: 'cover' }).webp({ quality: 30 }).toBuffer(),
  ])
  return { s160, s480, blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}` }
}

export function mediaContentType(format: PhotoVariant['format']): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}
