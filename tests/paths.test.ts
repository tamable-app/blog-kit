import { describe, expect, it } from 'vitest'
import { isReservedSlug, postPath, RESERVED_SLUGS, seriesPath, SERIES_PATH, tagPath, TAGS_PATH } from '../src/paths'

describe('blog addresses', () => {
  it('puts posts at /blog/<slug> and every other section under a word of its own', () => {
    expect(postPath('hello-world')).toBe('/blog/hello-world')
    expect(SERIES_PATH).toBe('/blog/series')
    expect(seriesPath('getting-started')).toBe('/blog/series/getting-started')
    expect(TAGS_PATH).toBe('/blog/tags')
    expect(tagPath('work')).toBe('/blog/tags/work')
  })

  it('reserves the word of every section, so no post can take its address', () => {
    for (const path of [SERIES_PATH, TAGS_PATH]) expect(isReservedSlug(path.split('/').pop()!)).toBe(true)
    expect(isReservedSlug('Series')).toBe(true)
    expect(isReservedSlug('hello-world')).toBe(false)
    expect([...RESERVED_SLUGS].sort()).toEqual(RESERVED_SLUGS)
  })
})
