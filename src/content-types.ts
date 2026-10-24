// What the site's pages work with, mapped from Tamable's shapes.

export interface Tag {
  name: string
  slug: string
}

export interface Cover {
  url: string
  alt: string
  width: number | null
  height: number | null
}

export interface PostSeries {
  slug: string
  title: string
  number: number
}

export interface PostSummary {
  slug: string
  path: string
  title: string
  excerpt: string | null
  cover: Cover | null
  publishedAt: string | null
  updatedAt: string | null
  series: PostSeries | null
  tags: Tag[]
  /** Null when only the list was read, since lists carry no body. */
  readingMinutes: number | null
}

export interface Post extends PostSummary {
  html: string
  readingMinutes: number
  seo: {
    title: string
    description: string | null
    canonicalUrl: string | null
  }
}

export interface SeriesSummary {
  slug: string
  title: string
  description: string | null
  postCount: number
}

export interface Series extends Omit<SeriesSummary, 'postCount'> {
  posts: PostSummary[]
}

export interface SeriesNav {
  slug: string
  title: string
  number: number
  total: number
  previous: PostSummary | null
  next: PostSummary | null
}

/** A post as its page needs it: with its place in a series, when it has one. */
export interface PostPage extends Post {
  seriesNav: SeriesNav | null
}
