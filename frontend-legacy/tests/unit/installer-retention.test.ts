import { describe, expect, it } from 'vitest'

function uninstallShouldDropDatabase(retainDatabase: boolean): boolean {
  return !retainDatabase
}

function uninstallShouldPreserveStorage(retainStorage: boolean): boolean {
  return retainStorage
}

function packagingArtifactsReady(paths: Record<string, boolean>): string[] {
  const required = ['jumanApiExe', 'winsw', 'jumanApiXml'] as const
  return required.filter((k) => !paths[k])
}

describe('installer retention policy', () => {
  it('keeps database when retain=true', () => {
    expect(uninstallShouldDropDatabase(true)).toBe(false)
  })
  it('drops juman db when retain=false', () => {
    expect(uninstallShouldDropDatabase(false)).toBe(true)
  })
  it('preserves storage by default', () => {
    expect(uninstallShouldPreserveStorage(true)).toBe(true)
  })
})

describe('packaging gate', () => {
  it('lists missing required artifacts', () => {
    expect(
      packagingArtifactsReady({ jumanApiExe: true, winsw: false, jumanApiXml: true })
    ).toEqual(['winsw'])
  })
  it('passes when all present', () => {
    expect(
      packagingArtifactsReady({ jumanApiExe: true, winsw: true, jumanApiXml: true })
    ).toEqual([])
  })
})