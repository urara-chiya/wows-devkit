import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'wows-number-api-sdk': fileURLToPath(
        new URL('../wows-number-api-sdk/src/index.ts', import.meta.url),
      ),
      'wows-replay-parser': fileURLToPath(
        new URL('../wows-replay-parser/src/index.ts', import.meta.url),
      ),
    },
  },
})
