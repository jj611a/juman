/** Whitelisted IPC channel names. */
export const IpcChannels = {
  API_INVOKE: 'juman:api:invoke',
  AUTH_GET_SESSION: 'juman:auth:getSession',
  AUTH_LOGIN: 'juman:auth:login',
  AUTH_CHANGE_PASSWORD: 'juman:auth:changePassword',
  AUTH_REFRESH: 'juman:auth:refresh',
  AUTH_LOGOUT: 'juman:auth:logout',
  AUTH_LOGOUT_ALL: 'juman:auth:logoutAll',
  AUTH_IS_AUTHENTICATED: 'juman:auth:isAuthenticated',
  AUTH_CHANGED: 'juman:auth:changed',
  SYSTEM_HEALTH: 'juman:system:health',
  SYSTEM_VERSION: 'juman:system:version',
  APP_GET_CONFIG: 'juman:app:getConfig',
  DESKTOP_DIALOG_MESSAGE: 'juman:desktop:dialog:message',
  DESKTOP_WINDOW_MINIMIZE: 'juman:desktop:window:minimize',
  DESKTOP_WINDOW_MAXIMIZE: 'juman:desktop:window:maximize',
  DESKTOP_WINDOW_CLOSE: 'juman:desktop:window:close',
  DESKTOP_WINDOW_IS_MAXIMIZED: 'juman:desktop:window:isMaximized',
  DESKTOP_WINDOW_SET_TITLE: 'juman:desktop:window:setTitle',
  DESKTOP_FS_STUB: 'juman:desktop:fs:stub',
  DESKTOP_PRINT_STUB: 'juman:desktop:print:stub',
  DESKTOP_BARCODE_STUB: 'juman:desktop:barcode:stub'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
