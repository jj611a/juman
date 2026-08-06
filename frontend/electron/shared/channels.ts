export const IpcChannels = {
  AUTH_GET_SESSION: 'auth:getSession',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_CHANGED: 'auth:changed',
  AUTH_CHANGE_PASSWORD: 'auth:changePassword',
  API_INVOKE: 'api:invoke',
  APP_GET_CONFIG: 'app:getConfig',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const
