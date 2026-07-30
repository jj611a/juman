const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function normalizePathTxt(electronRoot) {
  const pathTxt = path.join(electronRoot, 'path.txt')
  const platformPath = process.platform === 'win32' ? 'electron.exe' : 'electron'
  fs.writeFileSync(pathTxt, platformPath, { encoding: 'utf8' })
}

try {
  const electronRoot = path.dirname(require.resolve('electron/package.json'))
  const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron'
  const exe = path.join(electronRoot, 'dist', exeName)

  if (!fs.existsSync(exe)) {
    console.log('[ensure-electron] binary missing; running install.js')
    execFileSync(process.execPath, [path.join(electronRoot, 'install.js')], {
      stdio: 'inherit',
      cwd: electronRoot,
      env: process.env
    })
  }

  if (!fs.existsSync(exe)) {
    console.error('[ensure-electron] electron binary still missing after install.js')
    console.error('Try: Expand-Archive the cached zip into', path.join(electronRoot, 'dist'))
    process.exit(1)
  }

  normalizePathTxt(electronRoot)
  console.log('[ensure-electron] ok', exe)
} catch (error) {
  console.error('[ensure-electron] failed', error)
  process.exit(1)
}