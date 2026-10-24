import { describe, expect, it } from 'vitest'
import { createTamableClient, TamableError } from '../src/client'
import posts from '../fixtures/posts.json'
import post from '../fixtures/posts/hello-world.json'
import series from '../fixtures/series.json'
import redirects from '../fixtures/redirects.json'

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>

function fakeApi(route: Route) {
  const calls: Array<{ url: URL, init: RequestInit }> = []
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    return route(url, init)
  }) as typeof globalThis.fetch
  return { calls, fetch }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function client(route: Route, options: { readKey?: string, retries?: number } = {}) {
  const api = fakeApi(route)
  const sleeps: number[] = []
  const tamable = createTamableClient({
    apiUrl: 'https://api.tamable.test/api/v1/',
    readKey: options.readKey ?? 'read-key',
    fetch: api.fetch,
    retries: options.retries,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  })
  return { tamable, calls: api.calls, sleeps }
}

describe('Tamable client', () => {
  it('sends the read key as a bearer token and asks for JSON', async () => {
    const { tamable, calls } = client(() => json(posts))

    await tamable.allPosts()

    const headers = calls[0]!.init.headers as Record<string, string>
    expect(calls[0]!.url.origin + calls[0]!.url.pathname).toBe('https://api.tamable.test/api/v1/posts')
    expect(headers.Authorization).toBe('Bearer read-key')
    expect(headers.Accept).toBe('application/json')
  })

  it('refuses to run without a read key, so a build cannot come out empty', async () => {
    const { tamable, calls } = client(() => json(posts), { readKey: '' })

    await expect(tamable.allPosts()).rejects.toThrow('No Tamable read key is set')
    expect(calls).toHaveLength(0)
  })

  it('reads every page of posts, a hundred at a time, with filters', async () => {
    const page = (n: number, last: number) => ({ ...posts, data: [{ ...posts.data[0], slug: `post-${n}` }], meta: { ...posts.meta, current_page: n, last_page: last } })
    const { tamable, calls } = client(url => json(page(Number(url.searchParams.get('page')), 3)))

    const all = await tamable.allPosts({ tag: 'Writing Tips' })

    expect(all.map(p => p.slug)).toEqual(['post-1', 'post-2', 'post-3'])
    expect(calls.map(c => c.url.searchParams.get('page'))).toEqual(['1', '2', '3'])
    expect(calls.every(c => c.url.searchParams.get('per_page') === '100')).toBe(true)
    expect(calls[0]!.url.searchParams.get('tag')).toBe('Writing Tips')
  })

  it('finds a post by slug', async () => {
    const { tamable, calls } = client(() => json(post))

    const found = await tamable.getPost('hello-world')

    expect(found).toMatchObject({ kind: 'found', post: { title: 'Hello world' } })
    expect(calls[0]!.init.redirect).toBe('manual')
  })

  it('reports an old slug as moved instead of following the redirect', async () => {
    const { tamable } = client(() => json({ redirect: 'new-name' }, 301, { Location: 'https://api.tamable.test/api/v1/posts/new-name' }))

    expect(await tamable.getPost('old-name')).toEqual({ kind: 'moved', slug: 'new-name' })
  })

  it('reports an unknown slug as missing', async () => {
    const { tamable } = client(() => json({ message: 'Not found.' }, 404))

    expect(await tamable.getPost('nope')).toEqual({ kind: 'missing' })
  })

  it('reads redirects and series', async () => {
    const { tamable } = client(url => json(url.pathname.endsWith('/redirects') ? redirects : series))

    expect(await tamable.redirects()).toEqual(redirects.data)
    expect((await tamable.allSeries()).map(s => s.slug)).toEqual(['getting-started', 'empty-series'])
  })

  it('gives null for an unknown series and for an expired preview', async () => {
    const { tamable } = client(() => json({ message: 'Not found.' }, 404))

    expect(await tamable.getSeries('nope')).toBeNull()
    expect(await tamable.preview('expired')).toBeNull()
  })

  it('sends a preview token URL-encoded, slashes and all', async () => {
    const { tamable, calls } = client(() => json(post))

    await tamable.preview('eyJpdiI6/abc+def==')

    expect(calls[0]!.url.pathname).toBe('/api/v1/preview/eyJpdiI6%2Fabc%2Bdef%3D%3D')
  })

  it('retries a rate limit or server error, honouring Retry-After', async () => {
    const answers = [json({}, 429, { 'Retry-After': '3' }), json({}, 503), json(series)]
    const { tamable, calls, sleeps } = client(() => answers.shift()!)

    expect(await tamable.allSeries()).toHaveLength(2)
    expect(calls).toHaveLength(3)
    expect(sleeps).toEqual([3000, 1000])
  })

  it('fails with the status once retries run out, without the key in the message', async () => {
    const { tamable } = client(() => json({}, 500), { retries: 1 })

    const error = await tamable.allSeries().catch(e => e)

    expect(error).toBeInstanceOf(TamableError)
    expect(error.status).toBe(500)
    expect(error.message).not.toContain('read-key')
  })

  it('retries when Tamable does not answer, then fails', async () => {
    const { tamable, calls } = client(() => {
      throw new TypeError('fetch failed')
    })

    await expect(tamable.allSeries()).rejects.toThrow('Tamable didn\'t answer /series: fetch failed')
    expect(calls).toHaveLength(3)
  })

  it('keeps a preview token out of error messages', async () => {
    const { tamable } = client(() => {
      throw new TypeError('fetch failed')
    })

    const error = await tamable.preview('secret-token').catch(e => e)

    expect(error.message).toBe('Tamable didn\'t answer /preview: fetch failed')
  })

  it('fails on a 401 without retrying', async () => {
    const { tamable, calls } = client(() => json({ message: 'A valid site key is required.' }, 401))

    await expect(tamable.allPosts()).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(1)
  })
})
