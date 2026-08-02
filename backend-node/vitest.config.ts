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
      include: [
        'src/auth/**/*.ts',
        'src/users/**/*.ts',
        'src/roles/**/*.ts',
        'src/permissions/**/*.ts',
        'src/security/**/*.ts',
        'src/config/**/*.ts',
        'src/database/**/*.ts',
        'src/core/**/*.ts',
        'src/shared/**/*.ts',
        'src/settings/**/*.ts',
        'src/media/**/*.ts',
        'src/barcode/**/*.ts',
        'src/audit/**/*.ts',
        'src/customers/**/*.ts',
      ],
      exclude: [
        '**/*.module.ts',
        'src/auth/dto/**',
        'src/auth/decorators/**',
        'src/main.ts',
        'src/shared/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 72,
        statements: 80,
      },
    },
  },
});