import { Menu, app, type BrowserWindow } from 'electron'
import { openOrFocusDiagnosticsWindow } from './window'

export function installApplicationMenu(getMainWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'ملف',
      submenu: [isMac ? { role: 'close' } : { role: 'quit', label: 'خروج' }]
    },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع' },
        { role: 'redo', label: 'إعادة' },
        { type: 'separator' },
        { role: 'cut', label: 'قص' },
        { role: 'copy', label: 'نسخ' },
        { role: 'paste', label: 'لصق' },
        { role: 'selectAll', label: 'تحديد الكل' }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'reload', label: 'إعادة تحميل' },
        { role: 'toggleDevTools', label: 'أدوات المطوّر' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'تكبير افتراضي' },
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' }
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'التشخيص والاستعادة…',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            openOrFocusDiagnosticsWindow()
            getMainWindow()
          }
        },
        { type: 'separator' },
        {
          label: 'حول جمان',
          click: () => {
            const win = getMainWindow()
            win?.webContents.send('juman:menu:about')
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export function wantsDiagnosticsOnly(argv: string[] = process.argv): boolean {
  return argv.some((a) => a === '--diagnostics' || a === '/diagnostics')
}
