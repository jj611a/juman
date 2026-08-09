import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const failures = []

function assert(cond, msg) {
  if (!cond) failures.push(msg)
}

assert(existsSync(join(root, 'src/theme/globals.css')), 'missing design system globals')
assert(existsSync(join(root, 'src/layouts/shell/AppShell.tsx')), 'missing Phase 9 AppShell')
assert(existsSync(join(root, 'src/app/providers/AppProviders.tsx')), 'missing AppProviders')
assert(existsSync(join(root, 'src/router/AppRouter.tsx')), 'missing AppRouter')
assert(existsSync(join(root, 'src/navigation/nav.config.ts')), 'missing nav.config')
assert(existsSync(join(root, 'electron/main/auth/sessionManager.ts')), 'missing SessionManager')
assert(!existsSync(join(root, 'src/services/v2/legacyBridge.ts')), 'legacyBridge must not exist in new frontend')
assert(!existsSync(join(root, 'src/layouts/AppShell.tsx')), 'legacy AppShell path must be removed')

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'out') continue
      walk(p)
    } else if (/\.(ts|tsx)$/.test(name)) {
      const text = readFileSync(p, 'utf8')
      if (text.includes('legacyBridge')) failures.push(`forbidden legacyBridge in ${p}`)
      if (text.includes("from '@/core/")) failures.push(`forbidden @/core import in ${p}`)
    }
  }
}
walk(join(root, 'src'))

const requiredFeatures = [
  'authentication',
  'dashboard',
  'customers',
  'inventory',
  'categories',
  'brands',
  'colors',
  'sizes',
  'media',
  'barcode',
  'reservations',
  'rentals',
  'settlements',
  'finance',
  'reports',
  'users',
  'roles',
  'permissions',
  'hardware',
  'diagnostics',
  'settings',
  'audit',
]
for (const f of requiredFeatures) {
  assert(existsSync(join(root, 'src/features', f)), `missing feature folder: ${f}`)
}

if (failures.length) {
  console.error('Architecture validation FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('Architecture validation PASSED (Phase 9.1 shell)')
