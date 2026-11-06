export type OrderFileStatus = 'nao_conferido' | 'conferido' | 'aguardando_cliente' | 'aprovado' | 'necessita_alteracao'

/** orders.art_status — estado agregado do pedido inteiro (migration 054 + 094). */
export type ArtStatus =
  | 'nao_enviada'
  | 'recebida'
  | 'em_analise'
  | 'propostas_enviadas'
  | 'aguardando_escolha_cliente'
  | 'necessita_correcao'
  | 'aguardando_novo_arquivo'
  | 'aguardando_autorizacao_extra'
  | 'aprovada'
  | 'em_producao'

/** order_items.art_approval_status — estado da arte de UM item (migration 094). */
export type ArtApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'proposals_sent'
  | 'awaiting_choice'
  | 'revision_requested'
  | 'awaiting_extra_authorization'
  | 'approved'

export type ArtOrigin = 'own' | 'lumilife'

export interface ArtBrief {
  text?: string
  colors?: string
  style?: string
  description?: string
}

export type OrderFileRole = 'cliente_arte' | 'referencia' | 'proposta' | 'versao_final'

export interface OrderFile {
  id: string
  order_id: string
  /** Item do pedido a que este arquivo pertence — null em arquivos antigos (upload único por pedido). */
  order_item_id: string | null
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
  file_role: OrderFileRole
  proposal_number: number | null
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
  propostas_enviadas: 'Propostas enviadas',
  aguardando_escolha_cliente: 'Aguardando escolha do cliente',
  necessita_correcao: 'Necessita correção',
  aguardando_novo_arquivo: 'Aguardando novo arquivo',
  aguardando_autorizacao_extra: 'Aguardando autorização de alteração extra',
  aprovada: 'Aprovada',
  em_producao: 'Em produção',
}

export const ART_STATUS_COLORS: Record<ArtStatus, string> = {
  nao_enviada: 'bg-stone-100 text-stone-600 dark:bg-white/5 dark:text-stone-400',
  recebida: 'bg-info-light text-info-dark dark:bg-info/10 dark:text-info',
  em_analise: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  propostas_enviadas: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  aguardando_escolha_cliente: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  necessita_correcao: 'bg-error-light text-error-dark dark:bg-error/10 dark:text-error',
  aguardando_novo_arquivo: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  aguardando_autorizacao_extra: 'bg-error-light text-error-dark dark:bg-error/10 dark:text-error',
  aprovada: 'bg-success-light text-success-dark dark:bg-success/10 dark:text-success',
  em_producao: 'bg-primary-50 text-primary dark:bg-primary/10',
}

export const ART_APPROVAL_STATUS_LABELS: Record<ArtApprovalStatus, string> = {
  pending: 'Aguardando análise',
  in_review: 'Em análise pela equipe',
  proposals_sent: 'Propostas enviadas ao cliente',
  awaiting_choice: 'Aguardando escolha do cliente',
  revision_requested: 'Alteração solicitada',
  awaiting_extra_authorization: 'Aguardando autorização de alteração extra',
  approved: 'Arte aprovada',
}

export const ART_APPROVAL_STATUS_COLORS: Record<ArtApprovalStatus, string> = {
  pending: 'bg-stone-100 text-stone-600 dark:bg-white/5 dark:text-stone-400',
  in_review: 'bg-info-light text-info-dark dark:bg-info/10 dark:text-info',
  proposals_sent: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  awaiting_choice: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  revision_requested: 'bg-warning-light text-warning-dark dark:bg-warning/10 dark:text-warning',
  awaiting_extra_authorization: 'bg-error-light text-error-dark dark:bg-error/10 dark:text-error',
  approved: 'bg-success-light text-success-dark dark:bg-success/10 dark:text-success',
}

export const DEFAULT_REQUEST_MESSAGE =
  'Olá!\n\nRecebemos sua arte.\n\nEncontramos alguns pontos que precisam ser ajustados antes da produção.\n\nAssim que possível envie uma nova versão.\n\nObrigado!'
