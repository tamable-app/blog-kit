# @tamable/blog-kit

The pieces every [Tamable](https://tamable.app) blog starter shares, whatever the framework: reading posts from Tamable's read API, turning them into what pages need, feeds, redirects, checking Tamable's deploy webhook, and a fake Tamable for builds and tests without a key.

The starters built on it:

- [tamable-app/nuxt-blog](https://github.com/tamable-app/nuxt-blog)
- [tamable-app/next-blog](https://github.com/tamable-app/next-blog)
- [tamable-app/astro-blog](https://github.com/tamable-app/astro-blog)

It runs on the server only (Node 22 or newer). Your read key must never reach browser code.

```sh
npm install @tamable/blog-kit
```

## Read your posts

```ts
import { createContentSource, createTamableClient } from '@tamable/blog-kit'

const client = createTamableClient({
  apiUrl: 'https://api.tamable.app/api/v1',
  readKey: process.env.TAMABLE_READ_KEY!,
})

const content = createContentSource(client)

const posts = await content.allPosts() // every published post in full, newest first
const page = await content.postPage('hello-world') // one post, with its place in a series
const series = await content.seriesSummaries() // series with at least one published post
```

A content source reads each thing once and keeps it, which is what a build wants. In a dev server, pass `{ cache: false }` to always read fresh.

Post HTML comes ready to render: headings get `#` links to themselves and tables scroll inside their own box. Posts live at `/blog/{slug}`, so set Tamable's blog URL pattern to match.

`client` also reads one post (`getPost`, which tells you when a slug moved), one series, Tamable's redirects and previews:

```ts
const draft = await client.preview(token) // null once the link expired
```

## Feeds and redirects

```ts
import { buildRedirects, redirectPaths, rssXml, sitemapEntries, sitemapXml } from '@tamable/blog-kit'

const rss = rssXml(posts, { siteUrl, title: 'My blog', description: 'Notes and stories', language: 'en' })
const sitemap = sitemapXml(sitemapEntries(['/', '/blog', '/series'], posts, series), siteUrl)

// Every permanent redirect, as path to path, one hop each.
const redirects = buildRedirects({
  posts: await content.postSummaries(),
  renamed: redirectPaths(await client.redirects(), siteUrl), // posts renamed in Tamable
  ghost: false, // true to also answer an old Ghost blog's addresses
})
```

## The deploy webhook

When published content changes, Tamable calls your site's webhook with a signed request. `@tamable/blog-kit/webhook` checks the signature and the timestamp:

```ts
import { checkWebhook, handleDeploy, SIGNATURE_HEADER } from '@tamable/blog-kit/webhook'

// Rebuild the site through your host's build hook:
const reply = await handleDeploy({
  rawBody, // the request body exactly as received
  signature: request.headers.get(SIGNATURE_HEADER),
  secret: process.env.TAMABLE_WEBHOOK_SECRET!,
  deployHookUrl: process.env.DEPLOY_HOOK_URL!,
})
return Response.json(reply.body, { status: reply.status })

// Or do something else when content changes, like clearing a cache:
const check = checkWebhook({ rawBody, signature, secret })
if (check.kind === 'changed') revalidate()
```

## A fake Tamable

The package carries a small set of made-up posts and a server that answers with them like Tamable's read API does. Use it in CI so builds never need a real key:

```sh
npx fake-tamable                       # http://localhost:4010/api/v1, read key "fixture"
npx fake-tamable --port 4020 --fixtures ./my-fixtures
```

Or from code, in tests:

```ts
import { FAKE_READ_KEY, startFakeTamable } from '@tamable/blog-kit/fake'

const server = await startFakeTamable({ port: 4010 })
```

The fixtures themselves are importable too, for example `@tamable/blog-kit/fixtures/posts/hello-world.json`, a post with every kind of block.

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

To release, bump the version, merge, and publish a GitHub release: the release workflow publishes to npm.

## License

MIT
