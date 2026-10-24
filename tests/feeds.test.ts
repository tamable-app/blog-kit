import { describe, expect, it } from 'vitest'
import { toPost } from '../src/content'
import { escapeXml, rssXml, sitemapEntries, sitemapXml } from '../src/feeds'
import type { TamablePost } from '../src/types'
import product from '../fixtures/posts/hello-world.json'
import market from '../fixtures/posts/notes-on-writing.json'

const posts = [toPost(market.data as TamablePost), toPost(product.data as TamablePost)]
const site = 'https://example.com'
const channel = { siteUrl: site, title: 'My blog', description: 'Notes and stories, published from Tamable.', language: 'en' }

describe('the RSS feed', () => {
  const xml = rssXml(posts, channel)

  it('lists posts newest first with their links, dates, tags and full body', () => {
    expect(xml.indexOf('notes-on-writing')).toBeLessThan(xml.indexOf('hello-world'))
    expect(xml).toContain('<link>https://example.com/blog/hello-world</link>')
    expect(xml).toContain('<pubDate>Thu, 07 Mar 2024 09:00:00 GMT</pubDate>')
    expect(xml).toContain('<category>Writing Tips</category>')
    expect(xml).toContain('<content:encoded><![CDATA[<blockquote>')
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>')
  })

  it('escapes titles and keeps a body holding "]]>" inside its CDATA', () => {
    const tricky = { ...posts[0]!, title: 'Q&A <live>', html: '<p>a ]]> b</p>' }
    const out = rssXml([tricky], channel)

    expect(out).toContain('<title>Q&amp;A &lt;live&gt;</title>')
    expect(out).toContain('<![CDATA[<p>a ]]]]><![CDATA[> b</p>]]>')
  })

  it('escapes every XML special character', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;')
  })
})

describe('the sitemap', () => {
  it('lists the pages, every post with its last update, tags and series', () => {
    const entries = sitemapEntries(['/', '/blog'], posts, [{ slug: 'getting-started', title: 'Getting started', description: null, postCount: 1 }])
    const xml = sitemapXml(entries, site)

    expect(xml).toContain('<loc>https://example.com</loc>')
    expect(xml).toContain('<loc>https://example.com/blog/hello-world</loc>\n    <lastmod>2024-09-17T11:14:06+00:00</lastmod>')
    expect(xml).toContain('<loc>https://example.com/tags/writing-tips</loc>')
    expect(xml).toContain('<loc>https://example.com/series/getting-started</loc>')
    expect(xml.match(/<url>/g)).toHaveLength(2 + 2 + 2 + 1)
  })
})
