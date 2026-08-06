import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** Opaque token blob in OS-backed encryption — never exposed to renderer. */
export class SafeStorageCredentialStore {
  private readonly dir = join(app.getPath('userData'), 'secure')
  private readonly file = join(this.dir, 'session.bin')

  save(payload: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage encryption unavailable')
    }
    mkdirSync(this.dir, { recursive: true })
    const buf = safeStorage.encryptString(payload)
    writeFileSync(this.file, buf)
  }

  load(): string | null {
    if (!existsSync(this.file)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    const buf = readFileSync(this.file)
    return safeStorage.decryptString(buf)
  }

  clear(): void {
    if (existsSync(this.file)) unlinkSync(this.file)
  }
}
