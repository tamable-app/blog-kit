import { describe, expect, it } from 'vitest'
import { toPostSummary } from '../src/content'
import { buildRedirects, withoutTrailingSlash } from '../src/redirects'
import type { TamablePost } from '../src/types'
import posts from '../fixtures/posts.json'

const summaries = posts.data.map(post => toPostSummary(post as TamablePost))

describe('the redirect map', () => {
  it('answers nothing for Ghost addresses unless asked', () => {
    expect(buildRedirects({ posts: summaries, renamed: [] })).toEqual({})
  })

  it('sends Ghost post addresses to /blog', () => {
    const map = buildRedirects({ posts: summaries, renamed: [], ghost: true })

    expect(map['/hello-world']).toBe('/blog/hello-world')
    expect(map['/notes-on-writing']).toBe('/blog/notes-on-writing')
  })

  it('sends Ghost tag and feed addresses to their new homes', () => {
    const map = buildRedirects({ posts: summaries, renamed: [], ghost: true })

    expect(map['/tag/work']).toBe('/tags/work')
    expect(map['/tag/writing-tips']).toBe('/tags/writing-tips')
    expect(map['/rss']).toBe('/rss.xml')
    expect(map['/feed']).toBe('/rss.xml')
  })

  it('includes posts renamed in Tamable', () => {
    const map = buildRedirects({ posts: summaries, renamed: [{ from: '/blog/old-name', to: '/blog/hello-world' }] })

    expect(map['/blog/old-name']).toBe('/blog/hello-world')
  })

  it('resolves chains to one hop, so a post renamed twice still lands in one redirect', () => {
    const map = buildRedirects({
      posts: summaries,
      renamed: [
        { from: '/blog/first-name', to: '/blog/second-name' },
        { from: '/blog/second-name', to: '/blog/hello-world' },
      ],
    })

    expect(map['/blog/first-name']).toBe('/blog/hello-world')
    expect(map['/blog/second-name']).toBe('/blog/hello-world')
  })

  it('drops redirects that loop', () => {
    const map = buildRedirects({ posts: [], renamed: [{ from: '/blog/a', to: '/blog/b' }, { from: '/blog/b', to: '/blog/a' }] })

    expect(map).not.toHaveProperty('/blog/a')
    expect(map).not.toHaveProperty('/blog/b')
  })

  it('never takes over a live page, even when a post or an old slug shares its address', () => {
    const about = { ...summaries[0]!, slug: 'about', path: '/blog/about' }
    const map = buildRedirects({
      posts: [...summaries, about],
      renamed: [{ from: '/blog/hello-world', to: '/blog/about' }],
      ghost: true,
    })

    expect(map).not.toHaveProperty('/about')
    expect(map).not.toHaveProperty('/blog/hello-world')
    expect(Object.keys(map).every(from => !from.startsWith('/series') && !from.startsWith('/preview'))).toBe(true)
  })

  it('points every redirect at a page that exists, not at another redirect', () => {
    const map = buildRedirects({ posts: summaries, renamed: [{ from: '/blog/old', to: '/blog/hello-world' }], ghost: true })

    for (const to of Object.values(map)) expect(map).not.toHaveProperty(to)
  })
})

describe('dropping a trailing slash', () => {
  it('drops it, and leaves addresses without one alone', () => {
    expect(withoutTrailingSlash('/blog/')).toBe('/blog')
    expect(withoutTrailingSlash('/blog/post//')).toBe('/blog/post')
    expect(withoutTrailingSlash('/blog')).toBeNull()
    expect(withoutTrailingSlash('/')).toBeNull()
  })

  it('never produces an address on another site', () => {
    for (const path of ['//evil.example/', '///evil.example/', '/\\evil.example/', '//evil.example//x/']) {
      const target = withoutTrailingSlash(path)!
      expect(target.startsWith('/')).toBe(true)
      expect(target.startsWith('//')).toBe(false)
      expect(target.startsWith('/\\')).toBe(false)
    }
  })
})
