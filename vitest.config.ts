import { defineConfig } from 'vitest/config'
import path from 'path'

// Vitest configuration
// Unit tests: fast, no server needed
// Integration tests: need server (run separately with --config)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
