import type { TamableClient } from './client'
import { seriesNav, summarize, toPost, toPostSummary, toSeries, toSeriesSummary } from './content'
import type { Post, PostPage, PostSummary, Series, SeriesSummary } from './content-types'
import { prepareHtml } from './html'

export interface ContentSourceOptions {
  /** Keep what was read for the life of the process. Right for a build, wrong for a dev server. */
  cache?: boolean
  /** How many posts to read at once. */
  concurrency?: number
}

/** What a site's pages read: every published post, series and post pages, mapped and ready to render. */
export function createContentSource(client: TamableClient, { cache = true, concurrency = 4 }: ContentSourceOptions = {}) {
  const memo = new Map<string, Promise<unknown>>()

  /** During a build every page asks for the same data; fetch it once. */
  function once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!cache) return load()
    if (!memo.has(key)) {
      memo.set(key, load().catch((error) => {
        memo.delete(key)
        throw error
      }))
    }
    return memo.get(key) as Promise<T>
  }

  /** Every published post in full, newest first. One list request plus one per post, a few at a time. */
  function allPosts(): Promise<Post[]> {
    return once('posts', async () => {
      const list = await client.allPosts()
      return mapLimit(list, concurrency, async (item) => {
        const lookup = await client.getPost(item.slug ?? '')
        if (lookup.kind !== 'found') throw new Error(`Tamable listed ${item.slug} but did not serve it.`)
        const post = toPost(lookup.post)
        return { ...post, html: prepareHtml(post.html) }
      })
    })
  }

  async function postSummaries(): Promise<PostSummary[]> {
    return (await allPosts()).map(summarize)
  }

  /** Series with at least one published post; an empty one has nothing to show yet. */
  function seriesSummaries(): Promise<SeriesSummary[]> {
    return once('series', async () => (await client.allSeries()).map(toSeriesSummary).filter(series => series.postCount > 0))
  }

  /** One series with its published posts in order, carrying their reading times. */
  function seriesDetail(slug: string): Promise<Series | null> {
    return once(`series:${slug}`, async () => {
      const series = await client.getSeries(slug)
      if (!series?.posts.length) return null
      const bySlug = new Map((await allPosts()).map(post => [post.slug, summarize(post)]))
      return { ...toSeries(series), posts: series.posts.map(post => bySlug.get(post.slug ?? '') ?? toPostSummary(post)) }
    })
  }

  async function postPage(slug: string): Promise<PostPage | null> {
    const post = (await allPosts()).find(p => p.slug === slug)
    if (!post) return null
    const series = post.series ? await seriesDetail(post.series.slug) : null
    return { ...post, seriesNav: series ? seriesNav(series, slug) : null }
  }

  /** A draft through a preview link, ready to render like a post page, or null once the link expired. Never cached. */
  async function previewPage(token: string): Promise<PostPage | null> {
    const draft = await client.preview(token)
    if (!draft) return null
    const post = toPost(draft)
    return { ...post, html: prepareHtml(post.html), seriesNav: null }
  }

  return { allPosts, postSummaries, seriesSummaries, seriesDetail, postPage, previewPage }
}

export type ContentSource = ReturnType<typeof createContentSource>

async function mapLimit<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await map(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
