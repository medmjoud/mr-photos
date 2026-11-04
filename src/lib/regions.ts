import type { Locale } from '@/i18n/config'

/**
 * Browsing regions. These follow the 13 regions present in Natural Earth
 * (public domain) admin-1 data; Nouakchott groups the three Nouakchott
 * wilayas (Nord, Ouest, Sud) into one browsing area.
 */
export type Region = {
  slug: string
  iso: string
  name: Record<Locale, string>
  /** One factual line used on the interactive map. */
  blurb: Record<Locale, string>
}

export const regions: ReadonlyArray<Region> = [
  {
    slug: 'tiris-zemmour',
    iso: 'MR-11',
    name: { fr: 'Tiris Zemmour', ar: 'تيرس زمور', en: 'Tiris Zemmour' },
    blurb: {
      fr: 'Le grand nord minier, autour de Zouérat et de la Kediet ej Jill.',
      ar: 'الشمال المنجمي الكبير، حول ازويرات وكدية الجل.',
      en: 'The far mining north, around Zouérat and the Kediet ej Jill.',
    },
  },
  {
    slug: 'dakhlet-nouadhibou',
    iso: 'MR-08',
    name: { fr: 'Dakhlet Nouadhibou', ar: 'داخلة نواذيبو', en: 'Dakhlet Nouadhibou' },
    blurb: {
      fr: 'Nouadhibou, la presqu’île du Cap Blanc et la côte atlantique du nord.',
      ar: 'نواذيبو وشبه جزيرة الرأس الأبيض والساحل الأطلسي الشمالي.',
      en: 'Nouadhibou, the Cap Blanc peninsula and the northern Atlantic coast.',
    },
  },
  {
    slug: 'adrar',
    iso: 'MR-07',
    name: { fr: 'Adrar', ar: 'آدرار', en: 'Adrar' },
    blurb: {
      fr: 'Plateaux de grès, oasis et villes anciennes de Chinguetti et Ouadane.',
      ar: 'هضاب من الحجر الرملي وواحات ومدينتا شنقيط ووادان العريقتان.',
      en: 'Sandstone plateaus, oases and the old towns of Chinguetti and Ouadane.',
    },
  },
  {
    slug: 'inchiri',
    iso: 'MR-12',
    name: { fr: 'Inchiri', ar: 'إينشيري', en: 'Inchiri' },
    blurb: {
      fr: 'Entre désert et littoral, autour d’Akjoujt.',
      ar: 'بين الصحراء والساحل، حول أكجوجت.',
      en: 'Between desert and coast, around Akjoujt.',
    },
  },
  {
    slug: 'nouakchott',
    iso: 'MR-NKC',
    name: { fr: 'Nouakchott', ar: 'نواكشوط', en: 'Nouakchott' },
    blurb: {
      fr: 'La capitale, ses marchés, ses quartiers et la plage des pêcheurs.',
      ar: 'العاصمة بأسواقها وأحيائها وشاطئ الصيادين.',
      en: 'The capital: its markets, neighbourhoods and the fishermen’s beach.',
    },
  },
  {
    slug: 'trarza',
    iso: 'MR-06',
    name: { fr: 'Trarza', ar: 'الترارزة', en: 'Trarza' },
    blurb: {
      fr: 'Dunes du sud-ouest, Rosso et le fleuve Sénégal.',
      ar: 'كثبان الجنوب الغربي وروصو ونهر السنغال.',
      en: 'South-western dunes, Rosso and the Senegal River.',
    },
  },
  {
    slug: 'brakna',
    iso: 'MR-05',
    name: { fr: 'Brakna', ar: 'لبراكنة', en: 'Brakna' },
    blurb: {
      fr: 'D’Aleg aux rives du fleuve à Boghé.',
      ar: 'من ألاك إلى ضفاف النهر في بوكي.',
      en: 'From Aleg to the river banks at Boghé.',
    },
  },
  {
    slug: 'tagant',
    iso: 'MR-09',
    name: { fr: 'Tagant', ar: 'تكانت', en: 'Tagant' },
    blurb: {
      fr: 'Falaises, guelbs et cités anciennes, de Tidjikja à Tichitt.',
      ar: 'جروف وكلب ومدن عريقة، من تجكجة إلى تيشيت.',
      en: 'Escarpments and ancient towns, from Tidjikja to Tichitt.',
    },
  },
  {
    slug: 'gorgol',
    iso: 'MR-04',
    name: { fr: 'Gorgol', ar: 'كوركول', en: 'Gorgol' },
    blurb: {
      fr: 'La vallée du fleuve autour de Kaédi.',
      ar: 'وادي النهر حول كيهيدي.',
      en: 'The river valley around Kaédi.',
    },
  },
  {
    slug: 'assaba',
    iso: 'MR-03',
    name: { fr: 'Assaba', ar: 'لعصابة', en: 'Assaba' },
    blurb: {
      fr: 'Le massif de l’Assaba et la ville carrefour de Kiffa.',
      ar: 'جبال لعصابة ومدينة كيفة الملتقى.',
      en: 'The Assaba massif and the crossroads town of Kiffa.',
    },
  },
  {
    slug: 'guidimaka',
    iso: 'MR-10',
    name: { fr: 'Guidimakha', ar: 'كيدي ماغا', en: 'Guidimakha' },
    blurb: {
      fr: 'Le sud vert, autour de Sélibaby.',
      ar: 'الجنوب الأخضر، حول سيلبابي.',
      en: 'The green south, around Sélibaby.',
    },
  },
  {
    slug: 'hodh-el-gharbi',
    iso: 'MR-02',
    name: { fr: 'Hodh El Gharbi', ar: 'الحوض الغربي', en: 'Hodh El Gharbi' },
    blurb: {
      fr: 'Le Hodh occidental, autour d’Ayoun el Atrous.',
      ar: 'الحوض الغربي، حول لعيون.',
      en: 'The western Hodh, around Ayoun el Atrous.',
    },
  },
  {
    slug: 'hodh-ech-chargui',
    iso: 'MR-01',
    name: { fr: 'Hodh Ech Chargui', ar: 'الحوض الشرقي', en: 'Hodh Ech Chargui' },
    blurb: {
      fr: 'L’extrême est, de Néma à Oualata.',
      ar: 'أقصى الشرق، من النعمة إلى ولاتة.',
      en: 'The far east, from Néma to Oualata.',
    },
  },
]

export const regionSlugs = regions.map((r) => r.slug) as [string, ...Array<string>]

export function getRegion(slug: string | null | undefined): Region | undefined {
  return regions.find((r) => r.slug === slug)
}

export function regionName(slug: string | null | undefined, locale: Locale): string {
  return getRegion(slug)?.name[locale] ?? ''
}
