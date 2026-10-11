// The unit tests (`npm run test:unit`): everything under src/ and scripts/ named *.spec.ts, run in a simulated
// browser (jsdom). The browser tests (e2e/) and the security rules tests (tests/rules/) have their own runners and
// are left out here.
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**', 'tests/rules/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
