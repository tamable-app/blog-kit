#!/usr/bin/env node
// fake-tamable [--fixtures <folder>] [--port <port>]
import { parseArgs } from 'node:util'
import { startFakeTamable } from '../dist/fake.js'

const { values } = parseArgs({ options: { fixtures: { type: 'string' }, port: { type: 'string' } } })
const port = Number(values.port ?? 4010)

await startFakeTamable({ fixtures: values.fixtures, port })
console.log(`Fake Tamable on http://localhost:${port}/api/v1 (read key: fixture)`)
