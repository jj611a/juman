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
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/auth/**/*.ts'],
      exclude: [
        '**/*.module.ts',
        'src/auth/bootstrap/**',
        'src/auth/dto/**',
        'src/auth/decorators/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 75,
        statements: 93,
      },
    },
  },
});
