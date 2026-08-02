import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Coverage gate for Media domain (>=95%). */
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
    include: ['test/media-*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-media',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/media/**/*.ts'],
      exclude: ['**/*.module.ts', '**/dto/**', '**/media.controller.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 80,
        statements: 95,
      },
    },
  },
});
