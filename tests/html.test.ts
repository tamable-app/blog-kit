import { describe, expect, it } from 'vitest'
import { addHeadingAnchors, hasXPost, prepareHtml, wrapTables } from '../src/html'
import post from '../fixtures/posts/hello-world.json'

describe('preparing Tamable HTML for the page', () => {
  it('gives each heading with an id a link to itself', () => {
    expect(addHeadingAnchors('<h2 id="why-it-broke">Why it broke</h2><h3>No id</h3>')).toBe(
      '<h2 id="why-it-broke"><a class="heading-anchor" href="#why-it-broke" aria-label="Link to this section">#</a>Why it broke</h2><h3>No id</h3>',
    )
  })

  it('wraps every table in a scrolling box', () => {
    expect(wrapTables('<table><tbody></tbody></table><p>x</p><table></table>')).toBe(
      '<div class="table-wrap"><table><tbody></tbody></table></div><p>x</p><div class="table-wrap"><table></table></div>',
    )
  })

  it('spots an embedded X post', () => {
    expect(hasXPost(post.data.html)).toBe(true)
    expect(hasXPost('<blockquote><p>A quote</p></blockquote>')).toBe(false)
  })

  it('leaves the rest of the post as Tamable served it', () => {
    const prepared = prepareHtml(post.data.html)

    expect(prepared).toContain('<figure><img src="https://cdn.tamable.app/files/frame.png" alt="A diagram" width="1600" height="900"><figcaption>Hours per project</figcaption></figure>')
    expect(prepared).toContain('<a class="link-card" href="https://tamable.app"')
    expect(prepared.replace(/<a class="heading-anchor"[^>]*>#<\/a>/g, '').replace(/<\/?div[^>]*>/g, '')).toBe(post.data.html)
  })
})
