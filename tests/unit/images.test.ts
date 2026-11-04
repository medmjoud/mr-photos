import exifr from 'exifr'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ImageError, inspectImage, renderDerivatives } from '@/server/images/pipeline'
import { sniffImageType } from '@/server/images/sniff'

const limits = { maxBytes: 20e6, minLongEdge: 1200, minShortEdge: 800, maxPixels: 60e6 }

async function jpegWithGps(width = 1600, height = 1000) {
  return sharp({ create: { width, height, channels: 3, background: '#d98a52' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'Cam', Artist: 'Private' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '18/1 5/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '15/1 58/1 0/1' },
    })
    .toBuffer()
}

describe('content sniffing', () => {
  it('identifies formats from magic bytes, not names', async () => {
    expect(sniffImageType(await jpegWithGps())).toBe('image/jpeg')
    expect(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).png().toBuffer())).toBe('image/png')
    expect(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).webp().toBuffer())).toBe('image/webp')
    expect(sniffImageType(Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(64)))).toBeNull()
    expect(sniffImageType(Buffer.from('GIF89a'.padEnd(64)))).toBeNull()
  })
})

describe('upload inspection', () => {
  it('accepts a valid photo and reports oriented dimensions', async () => {
    expect(await inspectImage(await jpegWithGps(), limits)).toMatchObject({ mime: 'image/jpeg', width: 1600, height: 1000 })
  })
  it('rejects too-small images', async () => {
    await expect(inspectImage(await jpegWithGps(900, 600), limits)).rejects.toMatchObject({ code: 'resolution_too_low' })
  })
  it('rejects oversized files and non-images', async () => {
    await expect(inspectImage(await jpegWithGps(), { ...limits, maxBytes: 100 })).rejects.toMatchObject({ code: 'file_too_large' })
    await expect(inspectImage(Buffer.from('hello world, not an image at all'), limits)).rejects.toBeInstanceOf(ImageError)
  })
  it('rejects a truncated JPEG', async () => {
    const buf = await jpegWithGps()
    await expect(inspectImage(buf.subarray(0, Math.floor(buf.length / 3)), limits)).rejects.toMatchObject({ code: 'file_corrupt' })
  })
})

describe('derivatives', () => {
  it('strip all EXIF/GPS metadata and respect the preview long edge', async () => {
    const original = await jpegWithGps(2400, 1600)
    expect(await exifr.gps(original)).toBeTruthy()
    const out = await renderDerivatives(original, { authorName: 'Test Author', previewLongEdge: 1600, maxPixels: 60e6 })
    expect(out.outputs.length).toBeGreaterThan(6)
    for (const o of out.outputs) {
      const meta = await sharp(o.buffer).metadata()
      expect(meta.exif, `${o.kind}-${o.width}.${o.format}`).toBeUndefined()
      expect(meta.xmp).toBeUndefined()
      expect(meta.iptc).toBeUndefined()
      expect(await exifr.gps(o.buffer).catch(() => undefined)).toBeUndefined()
      if (o.kind === 'preview') expect(Math.max(o.width, o.height)).toBeLessThanOrEqual(1600)
    }
    expect(out.blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true)
    expect(out.blurDataUrl.length).toBeLessThan(1500)
  })
})
