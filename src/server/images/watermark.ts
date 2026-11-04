import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp, { type OverlayOptions, type Sharp } from 'sharp'

/**
 * Watermarks are rendered server-side with Pango (bundled in sharp/libvips)
 * from a font file shipped with the app — IBM Plex Sans Arabic covers both
 * Latin and Arabic author names (OFL licence, see assets/fonts).
 */
const FONT_FILE = 'IBMPlexSansArabic-SemiBold.ttf'
const FONT_NAME = 'IBM Plex Sans Arabic SemiBold'

export function watermarkFontPath(): string {
  const candidates = [
    process.env.WATERMARK_FONT_PATH,
    resolve(process.cwd(), 'assets/fonts', FONT_FILE),
  ].filter((p): p is string => Boolean(p))
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error(`watermark font not found (looked in: ${candidates.join(', ')})`)
  return found
}

function escapeMarkup(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Renders one line of text to a transparent PNG at roughly `px` cap height. */
export async function renderText(text: string, px: number, color: string, alphaPct: number): Promise<Sharp> {
  const markup = `<span foreground="${color}" fgalpha="${Math.round(alphaPct)}%">${escapeMarkup(text)}</span>`
  return sharp({
    text: {
      text: markup,
      fontfile: watermarkFontPath(),
      font: FONT_NAME,
      dpi: Math.max(36, Math.round(px * 6)),
      rgba: true,
    },
  })
}

export function creditLine(author: string): string {
  return `© ${author} · SOURA`
}

/**
 * Corner credit: white text with a soft dark copy underneath so it stays
 * legible on any photo. Returns an overlay positioned at the bottom-start.
 */
export async function creditOverlay(
  imageWidth: number,
  imageHeight: number,
  author: string,
): Promise<OverlayOptions> {
  const px = Math.max(11, Math.round(Math.min(imageWidth, imageHeight) * 0.022))
  const label = creditLine(author)
  const fg = await (await renderText(label, px, '#ffffff', 88)).png().toBuffer({ resolveWithObject: true })
  const shadow = await (await renderText(label, px, '#000000', 55)).blur(1.2).png().toBuffer()
  const pad = Math.round(px * 1.1)
  const w = fg.info.width + 4
  const h = fg.info.height + 4
  const tile = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, left: 2, top: 2 },
      { input: fg.data, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
  return {
    input: tile,
    left: pad,
    top: Math.max(0, imageHeight - h - pad),
  }
}

/**
 * Visible diagonal watermark tiled across the whole image (public previews).
 * Semi-transparent so the photograph can still be appreciated, but clearly
 * marked and impractical to crop out.
 */
export async function tiledOverlay(imageWidth: number, imageHeight: number, author: string): Promise<OverlayOptions> {
  const px = Math.max(14, Math.round(Math.max(imageWidth, imageHeight) * 0.016))
  const label = `SOURA   ·   © ${author}`
  const white = await (await renderText(label, px, '#ffffff', 26)).png().toBuffer({ resolveWithObject: true })
  const dark = await (await renderText(label, px, '#000000', 16)).png().toBuffer()
  const gapX = Math.round(px * 5)
  const gapY = Math.round(px * 5.5)
  const cell = await sharp({
    create: {
      width: white.info.width + gapX,
      height: white.info.height + gapY,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: dark, left: 2, top: 2 },
      { input: white.data, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
  const rotated = await sharp(cell)
    .rotate(-24, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return { input: rotated, tile: true, left: 0, top: 0 }
}
