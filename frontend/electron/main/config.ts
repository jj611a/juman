export interface MainConfig {
  apiBaseUrl: string
}

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'

export function loadMainConfig(): MainConfig {
  const fromEnv = process.env.JUMAN_API_BASE_URL?.trim()
  return {
    apiBaseUrl: fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, '') : DEFAULT_API_BASE_URL
  }
}
