import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface CredentialStore {
  getRefreshToken(): Promise<string | null>
  setRefreshToken(token: string): Promise<void>
  clearRefreshToken(): Promise<void>
}

/**
 * Persist refresh token using Electron safeStorage (OS-backed encryption on Windows).
 * Interface allows a future Keytar / Windows Credential Manager implementation.
 */
export class SafeStorageCredentialStore implements CredentialStore {
  private readonly filePath: string

  constructor(serviceName = 'juman-desktop') {
    const dir = join(app.getPath('userData'), 'credentials')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.filePath = join(dir, `${serviceName}.refresh.bin`)
  }

  async getRefreshToken(): Promise<string | null> {
    if (!existsSync(this.filePath)) {
      return null
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }
    const buf = readFileSync(this.filePath)
    try {
      return safeStorage.decryptString(buf)
    } catch {
      return null
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable')
    }
    const encrypted = safeStorage.encryptString(token)
    writeFileSync(this.filePath, encrypted)
  }

  async clearRefreshToken(): Promise<void> {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath)
    }
  }
}
