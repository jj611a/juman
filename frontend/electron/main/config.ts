export interface MainConfig {
  apiBaseUrl: string
}

export function loadMainConfig(): MainConfig {
  return {
    apiBaseUrl: process.env.JUMAN_API_BASE_URL?.trim() || 'http://127.0.0.1:8787'
  }
}
