import { describe, expect, it } from 'vitest'
import { readingMinutes, redirectPaths, seriesNav, toPost, toPostSummary, toSeriesSummary } from '../src/content'
import { slugify } from '../src/slug'
import type { TamablePost } from '../src/types'
import posts from '../fixtures/posts.json'
import post from '../fixtures/posts/hello-world.json'
import series from '../fixtures/series.json'

describe('mapping Tamable to the site', () => {
  it('gives a post its site path, tags with slugs and its SEO fields', () => {
    const mapped = toPost(post.data as TamablePost)

    expect(mapped.path).toBe('/blog/hello-world')
    expect(mapped.tags).toEqual([{ name: 'Work', slug: 'work' }])
    expect(mapped.seo).toEqual({
      title: 'Hello world',
      description: 'A first post, to see how everything looks.',
      canonicalUrl: 'https://example.com/blog/hello-world',
    })
    expect(mapped.html).toContain('<figcaption>Hours per project</figcaption>')
  })

  it('falls back to the title and excerpt when SEO fields are empty, and to the title for cover alt text', () => {
    const bare = { ...post.data, seo: { title: null, description: null, canonical_url: null }, cover: { url: 'https://cdn/x.png', description: null, width: 1600, height: 900 } } as TamablePost

    const mapped = toPost(bare)

    expect(mapped.seo.title).toBe(bare.title)
    expect(mapped.seo.description).toBe(bare.excerpt)
    expect(mapped.cover).toEqual({ url: 'https://cdn/x.png', alt: bare.title, width: 1600, height: 900 })
  })

  it('maps a draft with no title or slug yet, as a preview serves it', () => {
    const draft = { ...post.data, title: null, slug: null, url: null, published_at: null } as TamablePost

    expect(toPostSummary(draft)).toMatchObject({ title: 'Untitled draft', slug: '', path: '', publishedAt: null })
  })

  it('slugs tag names the way the tag pages are addressed', () => {
    expect(toPostSummary(posts.data[0] as TamablePost).tags).toEqual([
      { name: 'Writing Tips', slug: 'writing-tips' },
      { name: 'Work', slug: 'work' },
    ])
    expect(slugify('Ação & Reação: 2024!')).toBe('acao-reacao-2024')
  })

  it('counts reading time from the text, at least a minute', () => {
    expect(readingMinutes('<p>short</p>')).toBe(1)
    expect(readingMinutes(`<p>${'word '.repeat(1100)}</p>`)).toBe(5)
  })

  it('maps series summaries', () => {
    expect(toSeriesSummary(series.data[0]!)).toEqual({ slug: 'getting-started', title: 'Getting started', description: 'A short series on getting started.', postCount: 1 })
  })
})

describe('Tamable redirects as site paths', () => {
  it('turns full URLs into paths on the site, with or without www', () => {
    expect(redirectPaths([
      { from: 'https://example.com/blog/old/', to: 'https://www.example.com/blog/new' },
    ], 'https://example.com')).toEqual([{ from: '/blog/old', to: '/blog/new' }])
  })

  it('drops redirects to another host and ones that point at themselves', () => {
    expect(redirectPaths([
      { from: 'https://example.com/blog/a', to: 'https://elsewhere.com/blog/a' },
      { from: 'https://example.com/blog/same/', to: 'https://example.com/blog/same' },
    ], 'https://example.com')).toEqual([])
  })
})

describe('a post in its series', () => {
  const part = (slug: string, number: number) => ({ ...toPostSummary(post.data as TamablePost), slug, path: `/blog/${slug}`, series: { slug: 's', title: 'S', number } })
  const series = { slug: 's', title: 'S', description: null, posts: [part('one', 1), part('two', 2), part('four', 4)] }

  it('links the published parts either side, keeping the number Tamable gave it', () => {
    const nav = seriesNav(series, 'four')

    expect(nav).toMatchObject({ slug: 's', title: 'S', number: 4, total: 3, next: null })
    expect(nav?.previous?.slug).toBe('two')
  })

  it('has no previous part for the first one, and nothing for a post outside the series', () => {
    expect(seriesNav(series, 'one')?.previous).toBeNull()
    expect(seriesNav(series, 'elsewhere')).toBeNull()
  })
})
