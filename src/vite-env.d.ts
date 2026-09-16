/// <reference types="vite/client" />

import type { CSSProperties } from 'react'

declare global {
  const __APP_VERSION__: string
  const __APP_BUILD__: string
  
  interface Window {
    ImageViewer?: {
      show: (opts: { images: string[]; defaultIndex?: number }) => void
    }
  }
}

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}

export {}
