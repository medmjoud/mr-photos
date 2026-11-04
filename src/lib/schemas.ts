import { z } from 'zod'
import { categorySlugs } from './categories'
import { regionSlugs } from './regions'
import { cleanLine, cleanMultiline, parseTags } from './text'

/** Shared (client + server) validation for photo metadata. The server is authoritative. */
const yesNo = z.enum(['yes', 'no']).transform((v) => v === 'yes')
const confirmed = z.enum(['true', 'on']).transform(() => true)

export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 2000

export function photoMetaSchema(now = new Date()) {
  return z
    .object({
      title: z.string().transform(cleanLine).pipe(z.string().min(3).max(TITLE_MAX)),
      description: z.string().default('').transform(cleanMultiline).pipe(z.string().max(DESCRIPTION_MAX)),
      regionSlug: z.enum(regionSlugs),
      locationText: z.string().default('').transform(cleanLine).pipe(z.string().max(120)),
      category: z.enum(categorySlugs),
      authorName: z.string().transform(cleanLine).pipe(z.string().min(2).max(80)),
      yearTaken: z.coerce.number().int().min(1900).max(now.getFullYear()),
      tags: z.string().default('').transform(parseTags),
      hasPeople: yesNo,
      hasMinor: yesNo,
      confirmRights: confirmed,
      confirmConsent: confirmed,
      confirmRules: confirmed,
    })
    .refine((d) => !d.hasMinor || d.hasPeople, { path: ['hasMinor'], message: 'minor_requires_people' })
}

export type PhotoMetaInput = z.input<ReturnType<typeof photoMetaSchema>>
export type PhotoMeta = z.output<ReturnType<typeof photoMetaSchema>>
