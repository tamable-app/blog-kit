import type { Post, SeriesSummary } from './content-types'

const FEED_SIZE = 20

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** HTML inside CDATA, split wherever it holds `]]>` so the section can't end early. */
function cdata(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

export interface FeedChannel {
  siteUrl: string
  title: string
  description: string
  language: string
}

/** RSS 2.0 with each post's full body, newest first. */
export function rssXml(posts: Post[], { siteUrl, title, description, language }: FeedChannel, now = new Date()): string {
  const items = posts.slice(0, FEED_SIZE).map((post) => {
    const url = `${siteUrl}${post.path}`
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      post.publishedAt ? `      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : '',
      post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : '',
      ...post.tags.map(tag => `      <category>${escapeXml(tag.name)}</category>`),
      `      <content:encoded>${cdata(post.html)}</content:encoded>`,
      '    </item>',
    ].filter(Boolean).join('\n')
  })

  const updated = posts[0]?.publishedAt ? new Date(posts[0].publishedAt) : now

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`
}

export interface SitemapEntry {
  path: string
  lastmod?: string | null
}

export function sitemapEntries(pages: string[], posts: Post[], series: SeriesSummary[]): SitemapEntry[] {
  const latest = posts[0]?.updatedAt ?? null
  const tags = [...new Set(posts.flatMap(post => post.tags.map(tag => tag.slug)))].sort()
  return [
    ...pages.map(path => ({ path, lastmod: path === '/' || path === '/blog' ? latest : null })),
    ...posts.map(post => ({ path: post.path, lastmod: post.updatedAt })),
    ...tags.map(tag => ({ path: `/tags/${tag}` })),
    ...series.map(s => ({ path: `/series/${s.slug}` })),
  ]
}

export function sitemapXml(entries: SitemapEntry[], siteUrl: string): string {
  const urls = entries.map(entry => [
    '  <url>',
    `    <loc>${escapeXml(`${siteUrl}${entry.path === '/' ? '' : entry.path}`)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
    '  </url>',
  ].filter(Boolean).join('\n'))

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}
