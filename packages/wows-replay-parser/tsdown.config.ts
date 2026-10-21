import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/node.ts', 'src/extract.ts', 'src/extract-cli.ts'],
  dts: true,
  clean: true,
})
