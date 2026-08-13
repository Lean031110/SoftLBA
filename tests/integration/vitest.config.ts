import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../vitest.config'

// Integration test config — runs with global setup (server)
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/integration/**/*.test.ts'],
      globalSetup: ['tests/integration/global-setup.ts'],
      hookTimeout: 180000,
      testTimeout: 60000,
    },
  })
)
