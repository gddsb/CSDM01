import { useState, useEffect, useCallback } from 'react'

export interface BigScreenScaleOptions {
  designWidth?: number
  designHeight?: number
}

export function useBigScreenScale(options: BigScreenScaleOptions = {}) {
  const { designWidth = 1920, designHeight = 1080 } = options

  const [scale, setScale] = useState(1)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)

  const calcScale = useCallback(() => {
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const scaleX = windowWidth / designWidth
    const scaleY = windowHeight / designHeight
    const scaleRatio = Math.min(scaleX, scaleY)
    setScale(scaleRatio)
    setTranslateX((windowWidth - designWidth * scaleRatio) / 2)
    setTranslateY((windowHeight - designHeight * scaleRatio) / 2)
  }, [designWidth, designHeight])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  return {
    scale,
    translateX,
    translateY,
    style: {
      width: designWidth,
      height: designHeight,
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transformOrigin: 'left top',
    },
  }
}
