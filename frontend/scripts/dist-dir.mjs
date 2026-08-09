import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const outDir = resolve(repoRoot, 'frontend', 'out')
const releaseDir = resolve(repoRoot, 'frontend', 'release', 'win-unpacked')
const resourcesDir = resolve(releaseDir, 'resources')

console.log('Preparing unpacked app for electron-builder...')
console.log(`Source: ${outDir}`)
console.log(`Target: ${releaseDir}`)

// Clean and create target directory
if (existsSync(releaseDir)) {
  rmSync(releaseDir, { recursive: true, force: true })
}
mkdirSync(releaseDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

// Copy built app (main, preload, renderer) to release/win-unpacked
cpSync(outDir, releaseDir, { recursive: true })

// Copy deployment resources to resources/
const deployments = [
  { src: resolve(repoRoot, 'deployment', 'backend'), dest: resolve(resourcesDir, 'backend') },
  { src: resolve(repoRoot, 'deployment', 'runtime'), dest: resolve(resourcesDir, 'runtime') },
  { src: resolve(repoRoot, 'deployment', 'services'), dest: resolve(resourcesDir, 'services') },
  { src: resolve(repoRoot, 'deployment', 'scripts'), dest: resolve(resourcesDir, 'scripts') },
  { src: resolve(repoRoot, 'deployment', 'installer-wizard'), dest: resolve(resourcesDir, 'installer-wizard') },
]

for (const { src, dest } of deployments) {
  if (existsSync(src)) {
    console.log(`Copying ${src} -> ${dest}`)
    cpSync(src, dest, { recursive: true })
  } else {
    console.warn(`Warning: ${src} does not exist, skipping`)
  }
}

// Copy electron-builder config if exists
const builderConfig = resolve(repoRoot, 'frontend', 'electron-builder.yml')
if (existsSync(builderConfig)) {
  copyFileSync(builderConfig, resolve(releaseDir, 'electron-builder.yml'))
}

// Copy package.json to root of unpacked app
const pkgSrc = resolve(repoRoot, 'frontend', 'package.json')
const pkgDest = resolve(releaseDir, 'package.json')
copyFileSync(pkgSrc, pkgDest)

console.log('Unpacked app prepared successfully at:', releaseDir)