import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    pool: 'vmThreads',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
