/**
 * Where a blog's pages live. Everything sits under /blog: posts at /blog/<slug>, and each other section
 * under a word of its own (/blog/series/<slug>, /blog/tags/<tag>), so a new section never needs a new root.
 */
export const BLOG_PATH = '/blog'
export const SERIES_PATH = `${BLOG_PATH}/series`
export const TAGS_PATH = `${BLOG_PATH}/tags`

export function postPath(slug: string): string {
  return `${BLOG_PATH}/${slug}`
}

export function seriesPath(slug: string): string {
  return `${SERIES_PATH}/${slug}`
}

export function tagPath(tag: string): string {
  return `${TAGS_PATH}/${tag}`
}

/**
 * Words a post's slug can't be, because a section of the blog lives at /blog/<word>. Tamable never gives a
 * blog post one of these, so they are free for sections today and later. Keep in step with Tamable's list
 * (backend/app/Support/ReservedSlugs.php).
 */
export const RESERVED_SLUGS: readonly string[] = [
  'archive',
  'author',
  'authors',
  'categories',
  'category',
  'feed',
  'page',
  'rss',
  'search',
  'series',
  'tag',
  'tags',
  'topic',
  'topics',
]

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase())
}
