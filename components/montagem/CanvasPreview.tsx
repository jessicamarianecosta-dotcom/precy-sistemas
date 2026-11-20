'use client'

import { useEffect, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useMontagemStore, useMontagemComparison } from '@/lib/montagem/store'
import { computeCropMarks, computeTilePositions } from '@/lib/montagem/layout'

const RULER_SIZE = 20

export function CanvasPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const art = useMontagemStore((s) => s.art)
  const mode = useMontagemStore((s) => s.mode)
  const bobina = useMontagemStore((s) => s.bobina)
  const folha = useMontagemStore((s) => s.folha)
  const cropMarks = useMontagemStore((s) => s.cropMarks)
  const zoom = useMontagemStore((s) => s.zoom)
  const setZoom = useMontagemStore((s) => s.setZoom)
  const comparison = useMontagemComparison()

  const margins = mode === 'folha' ? folha.margins : bobina.margins
  const spacing = mode === 'folha' ? folha.spacing : bobina.spacing

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const result = comparison?.best
    const containerW = result?.containerWidthMm ?? (mode === 'folha' ? folha.sheetWidthMm : bobina.rollWidthMm)
    const containerH = result?.containerHeightMm ?? (mode === 'folha' ? folha.sheetHeightMm : (bobina.rollLengthMm ?? 300))

    // px por mm na tela: zoom é um fator relativo a "1mm = 2px" (base legível).
    const basePxPerMm = 2
    const pxPerMm = basePxPerMm * zoom

    const width = Math.max(1, Math.round(containerW * pxPerMm)) + RULER_SIZE
    const height = Math.max(1, Math.round(containerH * pxPerMm)) + RULER_SIZE
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // Réguas
    ctx.fillStyle = '#F5F0EB'
    ctx.fillRect(0, 0, width, RULER_SIZE)
    ctx.fillRect(0, 0, RULER_SIZE, height)
    ctx.fillStyle = '#8B6C4F'
    ctx.font = '9px sans-serif'
    ctx.textBaseline = 'middle'
    const stepMm = pxPerMm > 4 ? 10 : pxPerMm > 1.5 ? 50 : 100
    for (let m = 0; m <= containerW; m += stepMm) {
      const x = RULER_SIZE + m * pxPerMm
      ctx.beginPath(); ctx.moveTo(x, RULER_SIZE - 5); ctx.lineTo(x, RULER_SIZE); ctx.strokeStyle = '#8B6C4F'; ctx.stroke()
      ctx.fillText(String(m), x + 2, RULER_SIZE / 2)
    }
    for (let m = 0; m <= containerH; m += stepMm) {
      const y = RULER_SIZE + m * pxPerMm
      ctx.beginPath(); ctx.moveTo(RULER_SIZE - 5, y); ctx.lineTo(RULER_SIZE, y); ctx.stroke()
      ctx.save(); ctx.translate(2, y + 2); ctx.fillText(String(m), 0, 0); ctx.restore()
    }

    ctx.translate(RULER_SIZE, RULER_SIZE)

    // Fundo do container (folha/bobina)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#D9C4A9'
    ctx.lineWidth = 1
    ctx.fillRect(0, 0, containerW * pxPerMm, containerH * pxPerMm)
    ctx.strokeRect(0, 0, containerW * pxPerMm, containerH * pxPerMm)

    // Margens (linha tracejada)
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = '#C4893A'
    ctx.strokeRect(
      margins.left * pxPerMm,
      margins.top * pxPerMm,
      (containerW - margins.left - margins.right) * pxPerMm,
      (containerH - margins.top - margins.bottom) * pxPerMm,
    )
    ctx.restore()

    if (result?.fits && art) {
      const tiles = computeTilePositions(result, margins.left, margins.top, spacing.x, spacing.y)
      const img = new Image()
      img.onload = () => {
        for (const t of tiles) {
          ctx.drawImage(img, t.xMm * pxPerMm, t.yMm * pxPerMm, t.widthMm * pxPerMm, t.heightMm * pxPerMm)
          ctx.strokeStyle = 'rgba(139,108,79,0.25)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(t.xMm * pxPerMm, t.yMm * pxPerMm, t.widthMm * pxPerMm, t.heightMm * pxPerMm)
        }
        if (cropMarks.enabled) {
          const marks = computeCropMarks(tiles, cropMarks.markLengthMm, cropMarks.markOffsetMm)
          ctx.strokeStyle = '#2C2018'
          ctx.lineWidth = 0.75
          for (const m of marks) {
            ctx.beginPath()
            ctx.moveTo(m.x1Mm * pxPerMm, m.y1Mm * pxPerMm)
            ctx.lineTo(m.x2Mm * pxPerMm, m.y2Mm * pxPerMm)
            ctx.stroke()
          }
        }
      }
      img.src = art.dataUrl
    }
  }, [art, mode, bobina, folha, cropMarks, zoom, comparison, margins, spacing])

  function fitToScreen() {
    const wrapper = wrapperRef.current
    const result = comparison?.best
    if (!wrapper || !result) return
    const availW = wrapper.clientWidth - RULER_SIZE - 32
    const availH = wrapper.clientHeight - RULER_SIZE - 32
    const scale = Math.min(availW / result.containerWidthMm, availH / result.containerHeightMm) / 2
    setZoom(Math.max(0.1, Math.min(4, scale)))
  }

  return (
    <div className="card rounded-2xl p-4 flex flex-col h-full min-h-[420px]">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="font-semibold text-text-primary dark:text-stone-100">Visualização</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(zoom / 1.25)} className="p-1.5 rounded-lg hover:bg-primary-50 text-text-secondary" title="Diminuir zoom"><ZoomOut size={16} /></button>
          <span className="text-xs w-12 text-center text-text-secondary">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(zoom * 1.25)} className="p-1.5 rounded-lg hover:bg-primary-50 text-text-secondary" title="Aumentar zoom"><ZoomIn size={16} /></button>
          <button onClick={fitToScreen} className="p-1.5 rounded-lg hover:bg-primary-50 text-text-secondary" title="Ajustar à tela"><Maximize2 size={16} /></button>
        </div>
      </div>
      <div ref={wrapperRef} className="flex-1 overflow-auto rounded-xl bg-stone-100 dark:bg-stone-900 p-4" style={{ touchAction: 'pan-x pan-y' }}>
        <div className="flex items-center justify-center min-h-full">
          <canvas ref={canvasRef} className="shadow-sm" />
        </div>
      </div>
    </div>
  )
}
