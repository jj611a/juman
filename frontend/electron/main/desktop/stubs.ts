import { BrowserWindow, dialog } from 'electron'
import { notImplemented, type StubResult } from '../../shared/desktop'

export function createDesktopHandlers(getMainWindow: () => BrowserWindow | null) {
  return {
    async messageBox(options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning'
      title?: string
      message: string
    }): Promise<{ response: number }> {
      const win = getMainWindow()
      const boxOptions = {
        type: options.type ?? 'info',
        title: options.title ?? 'جمان',
        message: options.message,
        buttons: ['حسناً']
      }
      const result = win
        ? await dialog.showMessageBox(win, boxOptions)
        : await dialog.showMessageBox(boxOptions)
      return { response: result.response }
    },

    minimize(): void {
      getMainWindow()?.minimize()
    },

    maximize(): void {
      const win = getMainWindow()
      if (!win) return
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    },

    close(): void {
      getMainWindow()?.close()
    },

    isMaximized(): boolean {
      return getMainWindow()?.isMaximized() ?? false
    },

    setTitle(title: string): void {
      const win = getMainWindow()
      if (win) win.setTitle(title)
    },

    fsStub(): StubResult {
      return notImplemented('نظام الملفات')
    },

    printStub(): StubResult {
      return notImplemented('الطباعة')
    },

    barcodeStub(): StubResult {
      return notImplemented('قارئ الباركود')
    }
  }
}
