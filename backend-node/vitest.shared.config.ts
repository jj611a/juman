import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Coverage gate for Phase 3.1 shared business foundation only. */
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
    include: [
      'test/shared-*.spec.ts',
      'test/settings-*.spec.ts',
      'test/media-*.spec.ts',
      'test/barcode-*.spec.ts',
      'test/audit-*.spec.ts',
    ],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-shared',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: [
        'src/shared/**/*.ts',
        'src/settings/**/*.ts',
        'src/media/**/*.ts',
        'src/barcode/**/*.ts',
        'src/audit/**/*.ts',
      ],
      exclude: ['**/*.module.ts', '**/index.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95,
      },
    },
  },
});