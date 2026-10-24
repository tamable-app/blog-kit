// Tamable's HTML is predictable (one schema, one renderer), so these stay simple string passes.

/** `<h2 id="x">Text</h2>` gains a `#` link to itself. */
export function addHeadingAnchors(html: string): string {
  return html.replace(/<(h[1-6]) id="([^"]+)">/g, (_, tag: string, id: string) =>
    `<${tag} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a>`)
}

/** Wide tables scroll inside their own box instead of the page. */
export function wrapTables(html: string): string {
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
}

export function hasXPost(html: string): boolean {
  return html.includes('class="twitter-tweet"')
}

export function prepareHtml(html: string): string {
  return wrapTables(addHeadingAnchors(html))
}
