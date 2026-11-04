/** Public media URL for an approved photo variant (served by /media/p/*, status-checked). */
export function photoMediaPath(
  photoId: string,
  token: string,
  kind: 'thumb' | 'preview' | 'og',
  width: number,
  format: 'avif' | 'webp' | 'jpeg',
): string {
  return `/media/p/${photoId}/${token}/${kind}-${width}.${format}`
}

export function avatarMediaPath(userId: string, token: string, size: 160 | 480): string {
  return `/media/a/${userId}/${token}-${size}.webp`
}
