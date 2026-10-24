// The shapes Tamable's read API serves (/api/v1). Every response wraps its result in `data`.

export interface TamableCover {
  url: string
  description: string | null
  width: number | null
  height: number | null
}

export interface TamablePostSeries {
  slug: string
  title: string
  number: number
}

export interface TamablePost {
  id: string
  title: string | null
  slug: string | null
  url: string | null
  excerpt: string | null
  cover: TamableCover | null
  published_at: string | null
  updated_at: string | null
  series: TamablePostSeries | null
  seo: {
    title: string | null
    description: string | null
    canonical_url: string | null
  }
  tags: string[]
  html?: string | null
  content?: unknown
}

export interface TamablePage<T> {
  data: T[]
  links: { first: string | null, last: string | null, prev: string | null, next: string | null }
  meta: { current_page: number, last_page: number, per_page: number, total: number }
}

export interface TamableSeriesSummary {
  slug: string
  title: string
  description: string | null
  posts: number
}

export interface TamableSeries {
  slug: string
  title: string
  description: string | null
  posts: TamablePost[]
}

export interface TamableRedirect {
  from: string
  to: string
}
