'use client'

import { Ruler } from 'lucide-react'
import { FileImportPanel } from './FileImportPanel'
import { ModeTabs, UndoRedoButtons, CropMarksPanel } from './Toolbar'
import { BobinaForm } from './BobinaForm'
import { FolhaForm } from './FolhaForm'
import { ResultsSummary } from './ResultsSummary'
import { CanvasPreview } from './CanvasPreview'
import { ExportPanel } from './ExportPanel'
import { CutContourPanel } from './CutContourPanel'
import { BorderPanel } from './BorderPanel'
import { useMontagemStore } from '@/lib/montagem/store'

interface Props {
  variant: 'internal' | 'public'
}

export function MontagemStudio({ variant }: Props) {
  const mode = useMontagemStore((s) => s.mode)
  const art = useMontagemStore((s) => s.art)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
            <Ruler className="text-primary" size={24} />
            PRECY MONTAGEM
          </h1>
          <p className="text-sm text-text-secondary dark:text-stone-400 mt-0.5">
            Monte e aproveite artes gráficas em folhas ou bobinas, com cálculo exato de encaixe.
          </p>
        </div>
        <UndoRedoButtons />
      </div>

      {variant === 'public' && (
        <div className="rounded-xl bg-primary-50 dark:bg-primary/10 px-4 py-2.5 text-xs text-primary">
          Ferramenta gratuita e sem cadastro. Seus arquivos são processados no seu navegador e não ficam salvos em nenhum servidor.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)_320px] gap-5 items-start">
        {/* Painel esquerdo: importação + configuração */}
        <div className="space-y-4 order-1 min-w-0">
          <FileImportPanel />
          {art && (
            <div className="card rounded-2xl p-4 space-y-4">
              <ModeTabs />
              {mode === 'folha' ? <FolhaForm /> : <BobinaForm />}
            </div>
          )}
        </div>

        {/* Centro: visualização — sempre antes dos resultados/exportação no mobile
           (pra poder conferir antes de baixar) e "grudada" no topo da tela
           (sticky) enquanto se rola pelos ajustes de borda/faca/exportação
           abaixo, pra nunca precisar subir a tela pra ver o resultado.
           `self-start` é essencial: sem ele, um item de grid pode esticar
           para a altura da coluna mais alta (import+config ou resultados),
           e aí não sobra espaço pra "sticky" ter efeito — a altura máxima
           fica definida dentro do próprio CanvasPreview (card), não aqui.
           `min-w-0` (junto com `minmax(0,1fr)` na coluna) é essencial: sem
           ele, a prévia em tamanho real (que pode ficar bem larga numa
           bobina grande) força essa coluna do grid a crescer além do
           disponível, empurrando a coluna de resultados/exportação pra fora
           da tela — exatamente o bug de "sumir e não ter acesso" no
           computador, dependendo da medida da arte/bobina. */}
        <div className="order-2 sticky top-2 self-start z-10 min-w-0">
          <CanvasPreview />
        </div>

        {/* Direita: resultados + exportação */}
        <div className="space-y-4 order-3 min-w-0">
          <ResultsSummary />
          {art && <CropMarksPanel />}
          {art && art.kind !== 'shape' && <BorderPanel />}
          {art && art.kind !== 'shape' && <CutContourPanel />}
          {art && <ExportPanel />}
        </div>
      </div>
    </div>
  )
}
