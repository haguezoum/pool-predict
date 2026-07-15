import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'api/**/*.test.ts'],
    coverage: { reporter: ['text', 'json-summary'] },
  },
})
