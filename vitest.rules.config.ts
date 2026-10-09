// Security rules tests. They need the Firestore emulator, so run them with `npm run test:rules`.
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The tests use the app's own refs and queries (src/data).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Every file resets the same emulator database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
