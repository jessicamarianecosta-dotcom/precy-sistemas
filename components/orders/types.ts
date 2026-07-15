export type OrderFileStatus = 'nao_conferido' | 'conferido' | 'aguardando_cliente' | 'aprovado' | 'necessita_alteracao'
export type ArtStatus = 'nao_enviada' | 'recebida' | 'em_analise' | 'necessita_correcao' | 'aguardando_novo_arquivo' | 'aprovada' | 'em_producao'

export interface OrderFile {
  id: string
  order_id: string
  company_id: string
  file_name: string
  file_url: string
  file_path: string
  file_size: number
  mime_type: string | null
  uploaded_by: 'cliente' | 'equipe'
  status: OrderFileStatus
  review_notes: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface OrderArtEvent {
  id: string
  order_id: string
  company_id: string
  event_type: string
  description: string
  created_at: string
  created_by: string | null
}

export const FILE_STATUS_LABELS: Record<OrderFileStatus, string> = {
  nao_conferido: 'Ainda não conferido',
  conferido: 'Conferido',
  aguardando_cliente: 'Aguardando cliente',
  aprovado: 'Arquivo aprovado',
  necessita_alteracao: 'Necessita alteração',
}

export const ART_STATUS_LABELS: Record<ArtStatus, string> = {
  nao_enviada: 'Não enviada',
  recebida: 'Recebida',
  em_analise: 'Em análise',
  necessita_correcao: 'Necessita correção',
  aguardando_novo_arquivo: 'Aguardando novo arquivo',
  aprovada: 'Aprovada',
  em_producao: 'Em produção',
}

export const ART_STATUS_COLORS: Record<ArtStatus, string> = {
  nao_enviada: 'bg-stone-100 text-stone-600 dark:bg-white/5 dark:text-stone-400',
  recebida: 'bg-info-light text-info-dark dark:bg-info/10 dark:text-info',
  em_analise: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  necessita_correcao: 'bg-error-light text-error-dark dark:bg-error/10 dark:text-error',
  aguardando_novo_arquivo: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  aprovada: 'bg-success-light text-success-dark dark:bg-success/10 dark:text-success',
  em_producao: 'bg-primary-50 text-primary dark:bg-primary/10',
}

export const DEFAULT_REQUEST_MESSAGE =
  'Olá!\n\nRecebemos sua arte.\n\nEncontramos alguns pontos que precisam ser ajustados antes da produção.\n\nAssim que possível envie uma nova versão.\n\nObrigado!'
