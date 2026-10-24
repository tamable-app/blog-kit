import type {
  TamablePage,
  TamablePost,
  TamableRedirect,
  TamableSeries,
  TamableSeriesSummary,
} from './types'

export class TamableError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message)
    this.name = 'TamableError'
  }
}

export type PostLookup
  = | { kind: 'found', post: TamablePost }
    | { kind: 'moved', slug: string }
    | { kind: 'missing' }

export interface TamableClientOptions {
  apiUrl: string
  readKey: string
  fetch?: typeof fetch
  timeoutMs?: number
  retries?: number
  sleep?: (ms: number) => Promise<void>
}

export interface PostFilters {
  tag?: string
  series?: string
}

const PER_PAGE = 100

export function createTamableClient(options: TamableClientOptions) {
  const base = options.apiUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  const retries = options.retries ?? 2
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))

  // `label` names the request in errors; a preview passes one without its token.
  async function request(path: string, redirect: RequestRedirect = 'follow', label = path): Promise<Response> {
    if (!options.readKey) {
      throw new TamableError('No Tamable read key is set.', null)
    }

    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await doFetch(base + path, {
          headers: { Authorization: `Bearer ${options.readKey}`, Accept: 'application/json' },
          redirect,
          signal: AbortSignal.timeout(timeoutMs),
        })
      }
      catch (error) {
        if (attempt < retries) {
          await sleep(backoff(attempt))
          continue
        }
        throw new TamableError(`Tamable didn't answer ${label}: ${(error as Error).message}`, null)
      }

      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await sleep(backoff(attempt, response.headers.get('retry-after')))
        continue
      }

      return response
    }
  }

  async function json<T>(path: string): Promise<T> {
    const response = await request(path)
    if (!response.ok) {
      throw new TamableError(`Tamable answered ${response.status} for ${path}.`, response.status)
    }
    return await response.json() as T
  }

  function postsQuery(page: number, filters: PostFilters): string {
    const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
    if (filters.tag) query.set('tag', filters.tag)
    if (filters.series) query.set('series', filters.series)
    return `/posts?${query}`
  }

  return {
    /** Every published post, newest first, across all pages. */
    async allPosts(filters: PostFilters = {}): Promise<TamablePost[]> {
      const posts: TamablePost[] = []
      for (let page = 1; ; page++) {
        const result = await json<TamablePage<TamablePost>>(postsQuery(page, filters))
        posts.push(...result.data)
        if (result.meta.current_page >= result.meta.last_page) return posts
      }
    },

    /** One post. An old slug comes back as `moved`, read from the body rather than followed. */
    async getPost(slug: string): Promise<PostLookup> {
      const path = `/posts/${encodeURIComponent(slug)}`
      const response = await request(path, 'manual')

      if (response.status === 200) {
        return { kind: 'found', post: (await response.json() as { data: TamablePost }).data }
      }
      if (response.status === 301) {
        const body = await response.json() as { redirect?: string }
        if (body.redirect) return { kind: 'moved', slug: body.redirect }
      }
      if (response.status === 404) return { kind: 'missing' }

      throw new TamableError(`Tamable answered ${response.status} for ${path}.`, response.status)
    },

    async redirects(): Promise<TamableRedirect[]> {
      return (await json<{ data: TamableRedirect[] }>('/redirects')).data
    },

    async allSeries(): Promise<TamableSeriesSummary[]> {
      return (await json<{ data: TamableSeriesSummary[] }>('/series')).data
    },

    async getSeries(slug: string): Promise<TamableSeries | null> {
      const path = `/series/${encodeURIComponent(slug)}`
      const response = await request(path)
      if (response.status === 404) return null
      if (!response.ok) throw new TamableError(`Tamable answered ${response.status} for ${path}.`, response.status)
      return (await response.json() as { data: TamableSeries }).data
    },

    /** A draft through a preview link, or null once the link expired or belongs to another site. */
    async preview(token: string): Promise<TamablePost | null> {
      const path = `/preview/${encodeURIComponent(token)}`
      const response = await request(path, 'follow', '/preview')
      if (response.status === 404) return null
      if (!response.ok) throw new TamableError(`Tamable answered ${response.status} for the preview.`, response.status)
      return (await response.json() as { data: TamablePost }).data
    },
  }
}

export type TamableClient = ReturnType<typeof createTamableClient>

function backoff(attempt: number, retryAfter?: string | null): number {
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 10) * 1000
  return 500 * 2 ** attempt
}
