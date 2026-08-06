export const ipcWindow = {
  minimize: (): Promise<void> =>
    window.juman.window?.minimize() ?? Promise.resolve(),
  maximize: (): Promise<void> =>
    window.juman.window?.maximize() ?? Promise.resolve(),
  close: (): Promise<void> => window.juman.window?.close() ?? Promise.resolve(),
}
