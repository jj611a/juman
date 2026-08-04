import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    include: ['test/sales-*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-sales',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/sales/**/*.ts'],
      exclude: ['**/*.module.ts', '**/dto/**'],
      thresholds: {
        lines: 88,
        functions: 95,
        branches: 68,
        statements: 85,
      },
    },
  },
});
