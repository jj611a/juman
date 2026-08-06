import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Locate backend-node root (directory that owns prisma/schema.prisma).
 * Nest may emit to dist/ or dist/src/; vitest may run from src/.
 */
export function resolveBackendRoot(fromDir: string = __dirname): string {
  let dir = resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'prisma', 'schema.prisma'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Migration aborted: could not locate prisma/schema.prisma walking up from ${fromDir}`,
  );
}

function resolvePrismaCli(backendRoot: string): string {
  const candidates = [
    join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    join(backendRoot, '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  for (const base of [backendRoot, join(backendRoot, '..')]) {
    const bin = join(base, 'node_modules', '.bin', binName);
    if (existsSync(bin)) return bin;
  }
  throw new Error('Prisma CLI not found. Run pnpm install in the monorepo root.');
}

function runPrisma(
  prismaCli: string,
  args: string[],
  backendRoot: string,
  env: NodeJS.ProcessEnv,
): string {
  try {
    if (prismaCli.endsWith('.js')) {
      return execFileSync(process.execPath, [prismaCli, ...args], {
        cwd: backendRoot,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }
    return execFileSync(prismaCli, args, {
      cwd: backendRoot,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
  } catch (error: unknown) {
    const err = error as { stderr?: string | Buffer; stdout?: string | Buffer; message?: string };
    const detail = [err.stderr?.toString(), err.stdout?.toString(), err.message]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(detail || 'Prisma command failed');
  }
}

/**
 * Apply pending Prisma migrations before Nest boots.
 * Aborts with a clear diagnostic when migration or schema verification fails.
 */
export function runPendingMigrations(databaseUrl: string): { ok: true; backendRoot: string } {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(`Migration aborted: DATABASE_URL must be a SQLite file: URL (got ${databaseUrl})`);
  }

  const backendRoot = resolveBackendRoot();
  const schemaPath = join(backendRoot, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) {
    throw new Error(`Migration aborted: schema not found at ${schemaPath}`);
  }

  const prismaCli = resolvePrismaCli(backendRoot);
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const schemaArgs = ['--schema', schemaPath];

  try {
    runPrisma(prismaCli, ['migrate', 'deploy', ...schemaArgs], backendRoot, env);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('P3005')) {
      throw new Error(
        [
          'Prisma migrate deploy failed (P3005): database is not empty and has no migration history.',
          'This usually means juman.db was created by db push / a partial boot.',
          'Local recovery (dev only):',
          '  1) Stop the backend',
          '  2) Move/delete data/juman.db (and .db-wal / .db-shm if present)',
          '  3) pnpm start:dev',
          'Do NOT baseline a non-empty production DB without a deliberate migrate resolve plan.',
          detail,
        ].join('\n'),
      );
    }
    throw new Error(`Prisma migrate deploy failed. Backend will not start.\n${detail}`);
  }

  try {
    const status = runPrisma(prismaCli, ['migrate', 'status', ...schemaArgs], backendRoot, env);
    const normalized = status.toLowerCase();
    if (
      normalized.includes('following migration') ||
      normalized.includes('have not yet been applied')
    ) {
      throw new Error(`Schema verification failed: pending migrations remain.\n${status}`);
    }
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('Schema verification failed')) {
      throw error instanceof Error ? error : new Error(detail);
    }
    throw new Error(
      `Prisma migrate status failed after deploy. Backend will not start.\n${detail}`,
    );
  }

  return { ok: true, backendRoot };
}
