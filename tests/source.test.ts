import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTamableClient } from '../src/client'
import { FAKE_READ_KEY, startFakeTamable } from '../src/fake'
import { createContentSource } from '../src/source'

const port = 4917
let server: Server

beforeAll(async () => {
  server = await startFakeTamable({ port })
})

afterAll(() => {
  server.close()
})

function source(readKey = FAKE_READ_KEY) {
  return createContentSource(createTamableClient({ apiUrl: `http://localhost:${port}/api/v1`, readKey, retries: 0 }))
}

describe('the content source against the fake Tamable', () => {
  it('reads every post in full, newest first, with HTML ready to render', async () => {
    const posts = await source().allPosts()
    expect(posts.map(post => post.slug)).toEqual(['notes-on-writing', 'hello-world'])
    expect(posts[1]!.html).toContain('class="heading-anchor"')
    expect(posts[1]!.html).toContain('<div class="table-wrap"><table>')
  })

  it('places a post in its series', async () => {
    const page = await source().postPage('notes-on-writing')
    expect(page?.seriesNav).toMatchObject({ slug: 'getting-started', number: 1, total: 1, previous: null, next: null })
  })

  it('leaves out series with no published posts', async () => {
    expect((await source().seriesSummaries()).map(series => series.slug)).toEqual(['getting-started'])
  })

  it('reads a post only once per source', async () => {
    const content = source()
    expect(await content.allPosts()).toBe(await content.allPosts())
  })

  it('serves previews ready to render and refuses a wrong key', async () => {
    expect(await source().previewPage('ok/with/slash/')).toMatchObject({ title: 'A draft in progress', seriesNav: null })
    expect(await source().previewPage('expired')).toBeNull()
    await expect(source('wrong').allPosts()).rejects.toMatchObject({ status: 401 })
  })
})
