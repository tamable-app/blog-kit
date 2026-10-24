import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { fileURLToPath } from 'node:url'

/** The read key the fake API accepts. */
export const FAKE_READ_KEY = 'fixture'

export interface FakeTamableOptions {
  /** A folder shaped like the package's own `fixtures`. Defaults to those. */
  fixtures?: string
  port?: number
}

/** Serves recorded fixtures as Tamable's read API, for builds and tests without a real key. */
export function startFakeTamable({ fixtures = defaultFixtures(), port = 4010 }: FakeTamableOptions = {}): Promise<Server> {
  const root = fixtures.endsWith('/') ? fixtures : `${fixtures}/`

  function fixture(name: string): unknown {
    if (!name) return null
    const file = `${root}${name}.json`
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  }

  const server = createServer((request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    const path = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/^\/api\/v1/, '')

    if (request.headers.authorization !== `Bearer ${FAKE_READ_KEY}`) {
      return send(401, { message: 'A valid site key is required.' })
    }

    try {
      const body = fixture(fixtureName(path) ?? '')
      return body ? send(200, body) : send(404, { message: 'Not found.' })
    }
    catch {
      return send(500, { message: 'The fixture is not valid JSON.' })
    }
  })

  return new Promise(resolve => server.listen(port, () => resolve(server)))
}

/** The fixture that answers a read API path, or null for an address the API doesn't have. */
function fixtureName(path: string): string | null {
  if (['/posts', '/redirects', '/series'].includes(path)) return path.slice(1)
  const [, kind, rest] = path.match(/^\/(posts|series|preview)\/(.+)$/) ?? []
  if (!kind || !rest || (kind !== 'preview' && rest.includes('/'))) return null
  return `${kind}/${safe(rest)}`
}

/** Keeps a requested name inside the fixtures folder. */
function safe(segment: string): string {
  return decodeURIComponent(segment).replace(/[^a-z0-9-]/gi, '_')
}

function defaultFixtures(): string {
  return fileURLToPath(new URL('../fixtures/', import.meta.url))
}
