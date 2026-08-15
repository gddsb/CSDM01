/// <reference types="vite/client" />

interface Window {
  ImageViewer?: {
    show: (opts: { images: string[]; defaultIndex?: number }) => void
  }
}
