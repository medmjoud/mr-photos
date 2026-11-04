export type PageSection = { id: string; title: string; paragraphs?: Array<string>; list?: Array<string> }

export type PageContent = {
  eyebrow: string
  title: string
  lead: string
  /** Legal texts that must be reviewed by a lawyer before launch. */
  draft?: boolean
  updated?: string
  sections: Array<PageSection>
}

export type PageKey = 'about' | 'forPhotographers' | 'contentRules' | 'terms' | 'privacy' | 'report'
export type PagesContent = Record<PageKey, PageContent>
