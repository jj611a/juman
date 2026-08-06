import type { JumanBridge } from '../../electron/preload/index'

declare global {
  interface Window {
    juman: JumanBridge
  }
}

export {}
