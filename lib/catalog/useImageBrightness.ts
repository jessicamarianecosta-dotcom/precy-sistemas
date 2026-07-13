'use client'

import { useEffect, useState } from 'react'

export type BrightnessLevel = 'dark' | 'medium' | 'light'

/**
 * Amostra o banner num canvas pequeno e calcula o brilho médio (luminância
 * perceptual) para decidir o quanto escurecer o overlay — banners claros
 * precisam de mais overlay para o texto continuar legível.
 * Se o carregamento/canvas falhar (ex: CORS), cai em 'medium' com segurança.
 */
export function useImageBrightness(url: string | null | undefined): BrightnessLevel {
  const [level, setLevel] = useState<BrightnessLevel>('medium')

  useEffect(() => {
    if (!url) { setLevel('medium'); return }
    let cancelled = false

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        }
        const avg = sum / (data.length / 4)
        if (!cancelled) setLevel(avg > 170 ? 'light' : avg > 90 ? 'medium' : 'dark')
      } catch {
        if (!cancelled) setLevel('medium')
      }
    }
    img.onerror = () => { if (!cancelled) setLevel('medium') }
    img.src = url

    return () => { cancelled = true }
  }, [url])

  return level
}
