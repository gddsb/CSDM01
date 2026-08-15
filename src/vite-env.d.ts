/// <reference types="vite/client" />

import type { CSSProperties } from 'react'

declare global {
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
