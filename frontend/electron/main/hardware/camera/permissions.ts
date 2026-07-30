import { session } from 'electron'

/** Allow media (camera/mic) for the app origin; deny others. */
export function installCameraPermissionHandler(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })
}