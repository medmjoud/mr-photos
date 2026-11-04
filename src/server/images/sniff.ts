/**
 * Detects the real image type from file contents (magic bytes) — the file
 * name and the browser-provided MIME type are never trusted.
 */
export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic'

export function sniffImageType(buf: Uint8Array): SniffedType | null {
  if (buf.length < 16) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return 'image/png'
  // WebP: "RIFF" .... "WEBP"
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp'
  // ISO-BMFF: size(4) "ftyp" brand(4)
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
  }
  return null
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buf.subarray(start, end))
}

/** Types we accept for upload. HEIC is detected only to return a helpful error. */
export const ACCEPTED_TYPES: ReadonlyArray<SniffedType> = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export const EXTENSION: Record<SniffedType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
}
