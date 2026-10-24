import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/webhook.ts', 'src/fake.ts'],
  format: 'esm',
  target: 'node22',
  dts: true,
  clean: true,
})
