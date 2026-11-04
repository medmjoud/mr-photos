/**
 * Shared zod schemas for server-function validators. Kept out of the
 * functions files' module scope so the client bundle never includes zod
 * (validators are stripped from client builds; module-level schemas are not).
 */
import { z } from 'zod'
import { locales } from '@/i18n/config'
import { categorySlugs, orientations } from '@/lib/categories'
import { regionSlugs } from '@/lib/regions'
import { PASSWORD_MAX, PASSWORD_MIN } from './auth/password'

export const zId = z.string().regex(/^[a-z0-9]{16}$/)
export const zSlug = z.string().regex(/^[a-z0-9-]{1,80}$/)
export const zLocale = z.enum(locales)
export const zNote = z.string().max(1000).default('')
export const zEmail = z.string().trim().toLowerCase().max(254).pipe(z.email())
export const zPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX)

export const zWebsite = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), 'https_only')
export const zInstagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/))
/** E.164 digits without "+", e.g. 22236123456 (Mauritania +222). */
export const zWhatsapp = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, '').replace(/^\+/, '').replace(/^00/, ''))
  .pipe(z.string().regex(/^(\d{8,15})?$/))

export const exploreSearchSchema = z.object({
  q: z.string().max(100).optional(),
  region: z.enum(regionSlugs).optional(),
  category: z.enum(categorySlugs).optional(),
  orientation: z.enum(orientations).optional(),
  photographer: zSlug.optional(),
  page: z.number().int().min(1).max(500).optional(),
})
