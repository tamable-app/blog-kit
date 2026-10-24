import type { Cover, Post, PostSummary, Series, SeriesNav, SeriesSummary, Tag } from './content-types'
import type { TamableCover, TamablePost, TamableRedirect, TamableSeries, TamableSeriesSummary } from './types'
import { slugify } from './slug'

const WORDS_PER_MINUTE = 220

export function postPath(slug: string): string {
  return `/blog/${slug}`
}

export function toTag(name: string): Tag {
  return { name, slug: slugify(name) }
}

function toCover(cover: TamableCover | null, title: string): Cover | null {
  if (!cover) return null
  return { url: cover.url, alt: cover.description ?? title, width: cover.width, height: cover.height }
}

export function toPostSummary(post: TamablePost): PostSummary {
  const slug = post.slug ?? ''
  const title = post.title ?? 'Untitled draft'
  return {
    slug,
    path: slug ? postPath(slug) : '',
    title,
    excerpt: post.excerpt,
    cover: toCover(post.cover, title),
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
    series: post.series,
    tags: post.tags.map(toTag),
    readingMinutes: null,
  }
}

/** A full post as a list item, keeping its reading time. */
export function summarize(post: Post): PostSummary {
  const { html: _html, seo: _seo, ...summary } = post
  return summary
}

export function toPost(post: TamablePost): Post {
  const summary = toPostSummary(post)
  const html = post.html ?? ''
  return {
    ...summary,
    html,
    readingMinutes: readingMinutes(html),
    seo: {
      title: post.seo.title ?? summary.title,
      description: post.seo.description ?? summary.excerpt,
      canonicalUrl: post.seo.canonical_url,
    },
  }
}

export function toSeriesSummary(series: TamableSeriesSummary): SeriesSummary {
  return { slug: series.slug, title: series.title, description: series.description, postCount: series.posts }
}

export function toSeries(series: TamableSeries): Series {
  return { slug: series.slug, title: series.title, description: series.description, posts: series.posts.map(toPostSummary) }
}

/** Where a post sits in its series: published parts only, so the previous and next always exist on the site. */
export function seriesNav(series: Series, slug: string): SeriesNav | null {
  const index = series.posts.findIndex(post => post.slug === slug)
  const post = series.posts[index]
  if (!post?.series) return null
  return {
    slug: series.slug,
    title: series.title,
    number: post.series.number,
    total: series.posts.length,
    previous: series.posts[index - 1] ?? null,
    next: series.posts[index + 1] ?? null,
  }
}

export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** Tamable's redirects are full URLs; the site needs paths on its own host. */
export function redirectPaths(redirects: TamableRedirect[], siteUrl: string): Array<{ from: string, to: string }> {
  const host = hostOf(siteUrl)
  return redirects.flatMap(({ from, to }) => {
    const source = new URL(from)
    const target = new URL(to)
    if (hostOf(source.href) !== host || hostOf(target.href) !== host) return []
    const paths = { from: trimSlash(source.pathname), to: trimSlash(target.pathname) }
    return paths.from === paths.to ? [] : [paths]
  })
}

function hostOf(url: string): string {
  return new URL(url).host.replace(/^www\./, '')
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}
