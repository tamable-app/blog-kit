import type { PostSummary } from './content-types'

/** Addresses a starter serves itself; no redirect may take one over. */
export const LIVE_PATHS = ['/', '/blog', '/series', '/tags', '/about', '/preview', '/api', '/rss.xml', '/sitemap.xml', '/robots.txt']

export interface RedirectInput {
  posts: PostSummary[]
  /** Tamable's renamed posts, already as paths on this site. */
  renamed: Array<{ from: string, to: string }>
  /** Also answer Ghost's old post, tag and feed addresses. */
  ghost?: boolean
  /** Addresses the site serves itself. Defaults to LIVE_PATHS. */
  live?: string[]
}

/**
 * Every permanent redirect the site answers, as `from` path to `to` path, one hop each:
 * posts renamed in Tamable and, when moving from Ghost, its old post, tag and feed addresses.
 */
export function buildRedirects({ posts, renamed, ghost = false, live: roots = LIVE_PATHS }: RedirectInput): Record<string, string> {
  const live = new Set([...roots, ...posts.map(post => post.path)])
  const tags = new Set(posts.flatMap(post => post.tags.map(tag => tag.slug)))
  const map = new Map<string, string>()

  const add = (from: string, to: string) => {
    if (from === to || isLive(from, live, roots)) return
    map.set(from, to)
  }

  if (ghost) {
    for (const post of posts) add(`/${post.slug}`, post.path)
    for (const tag of tags) add(`/tag/${tag}`, `/tags/${tag}`)
    add('/rss', '/rss.xml')
    add('/feed', '/rss.xml')
  }
  for (const { from, to } of renamed) add(from, to)

  // Follow chains to their end, so every redirect is one hop, and drop any that loop.
  const resolved: Record<string, string> = {}
  for (const from of map.keys()) {
    const seen = new Set([from])
    let to = map.get(from)!
    while (map.has(to) && !seen.has(to)) {
      seen.add(to)
      to = map.get(to)!
    }
    if (!seen.has(to)) resolved[from] = to
  }
  return resolved
}

function isLive(path: string, live: Set<string>, roots: string[]): boolean {
  return live.has(path) || roots.some(root => root !== '/' && path.startsWith(`${root}/`) && !path.startsWith('/blog/'))
}

/**
 * The address without its trailing slash, or null when it has none. Leading slashes and
 * backslashes collapse to one, so `//evil.example/` can never become a redirect off the site.
 */
export function withoutTrailingSlash(pathname: string): string | null {
  if (pathname.length <= 1 || !pathname.endsWith('/')) return null
  const trimmed = `/${pathname.replace(/\/+$/, '').replace(/^[/\\]+/, '')}`
  return trimmed === pathname ? null : trimmed
}
