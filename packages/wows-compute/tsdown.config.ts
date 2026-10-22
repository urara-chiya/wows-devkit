import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/match.ts', 'src/metrics.ts', 'src/strength.ts'],
  tsconfig: 'tsconfig.build.json',
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['wows-number-api-sdk'],
  },
})
