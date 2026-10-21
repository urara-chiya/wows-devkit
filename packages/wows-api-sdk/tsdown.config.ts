import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/official.ts', 'src/vortex.ts', 'src/clans.ts'],
  dts: true,
  clean: true,
})
