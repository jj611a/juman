import type { JumanPreloadApi } from '@shared/preload'

declare global {
  interface Window {
    juman: JumanPreloadApi
  }
}

export {}
