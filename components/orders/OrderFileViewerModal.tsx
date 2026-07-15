'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '@/lib/utils/pdfWorker'
import {
  X, Download, ZoomIn, ZoomOut, RotateCw, Maximize, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react'
import { getFileKind, getDownloadUrl } from '@/lib/utils/fileIcons'
import type { OrderFile } from './types'

interface Props {
  file: OrderFile
  onClose: () => void
}

export function OrderFileViewerModal({ file, onClose }: Props) {
  const kind = getFileKind(file.file_name)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        ref={containerRef}
        className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border dark:border-border-dark flex-shrink-0">
          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">{file.file_name}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {kind.isImage && (
              <>
                <button type="button" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Diminuir zoom"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><ZoomOut size={16} /></button>
                <button type="button" onClick={() => setZoom(z => Math.min(4, z + 0.25))} title="Aumentar zoom"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><ZoomIn size={16} /></button>
                <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} title="Rotacionar"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><RotateCw size={16} /></button>
                <button type="button" onClick={toggleFullscreen} title="Tela cheia"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><Maximize size={16} /></button>
              </>
            )}
            {kind.isPdf && (
              <>
                <button type="button" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Diminuir zoom"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><ZoomOut size={16} /></button>
                <button type="button" onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Aumentar zoom"
                  className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><ZoomIn size={16} /></button>
              </>
            )}
            <a href={getDownloadUrl(file.file_url, file.file_name)} title="Baixar original"
              className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><Download size={16} /></a>
            <button type="button" onClick={onClose} title="Fechar"
              className="p-2 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto bg-stone-100 dark:bg-black/30 flex items-center justify-center p-4">
          {kind.isImage && (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="max-w-none transition-transform"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          )}

          {kind.isPdf && (
            <Document
              file={file.file_url}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNumber(1) }}
              loading={<Loader2 size={24} className="animate-spin text-text-muted" />}
              error={<p className="text-sm text-error">Não foi possível carregar o PDF.</p>}
            >
              <Page pageNumber={pageNumber} scale={zoom} />
            </Document>
          )}

          {!kind.isImage && !kind.isPdf && (
            <div className="flex flex-col items-center gap-3 text-text-muted">
              <kind.Icon size={64} />
              <p className="text-sm">Sem preview disponível para {kind.label}.</p>
              <a href={getDownloadUrl(file.file_url, file.file_name)} className="btn-primary flex items-center gap-2">
                <Download size={14} /> Baixar arquivo
              </a>
            </div>
          )}
        </div>

        {/* Paginação (PDF) */}
        {kind.isPdf && numPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-2.5 border-t border-border dark:border-border-dark flex-shrink-0">
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)}
              className="p-1.5 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-secondary dark:text-stone-400">Página {pageNumber} de {numPages}</span>
            <button type="button" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)}
              className="p-1.5 rounded-lg text-text-muted hover:bg-primary-50 dark:hover:bg-white/5 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
