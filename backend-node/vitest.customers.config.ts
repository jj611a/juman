import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Coverage gate for Customer domain (≥95%). */
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
    include: ['test/customers-*.spec.ts', 'test/phone-*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-customers',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/customers/**/*.ts', 'src/shared/phone/**/*.ts'],
      exclude: ['**/*.module.ts', '**/dto/**'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 80,
        statements: 95,
      },
    },
  },
});