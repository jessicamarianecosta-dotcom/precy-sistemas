'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare, Lightbulb, Bug, AlertTriangle, Heart, Rocket,
  Paperclip, X, Loader2, CheckCircle2, History,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────── */

const FEEDBACK_TYPES = [
  { value: 'sugestao',            label: 'Sugestão',            icon: Lightbulb,     emoji: '💡', color: '#3B82F6' },
  { value: 'bug',                 label: 'Bug',                 icon: Bug,           emoji: '🐞', color: '#EF4444' },
  { value: 'reclamacao',          label: 'Reclamação',          icon: AlertTriangle, emoji: '⚠️', color: '#F59E0B' },
  { value: 'elogio',              label: 'Elogio',               icon: Heart,         emoji: '❤️', color: '#EC4899' },
  { value: 'nova_funcionalidade', label: 'Nova funcionalidade', icon: Rocket,        emoji: '🚀', color: '#8B6C4F' },
] as const

type FeedbackType = typeof FEEDBACK_TYPES[number]['value']

const PRIORITY_OPTIONS = [
  { value: 'baixa',  label: 'Baixa'  },
  { value: 'normal', label: 'Normal' },
  { value: 'alta',   label: 'Alta'   },
] as const

const STATUS_META: Record<string, { label: string; cls: string }> = {
  novo:        { label: 'Novo',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  em_analise:  { label: 'Em análise',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  respondido:  { label: 'Respondido',  cls: 'bg-primary-50 text-primary dark:bg-primary/10' },
  concluido:   { label: 'Concluído',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const MESSAGE_MIN = 30
const MESSAGE_MAX = 3000
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FILE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function FeedbackPage() {
  const supabase       = createClient()
  const queryClient    = useQueryClient()
  const { toast }      = useToast()
  const { companyId }  = useCompanyId()
  const fileInputRef   = useRef<HTMLInputElement>(null)

  const [type, setType]               = useState<FeedbackType | ''>('')
  const [subject, setSubject]         = useState('')
  const [message, setMessage]         = useState('')
  const [priority, setPriority]       = useState<'baixa' | 'normal' | 'alta'>('normal')
  const [allowContact, setAllowContact] = useState(false)
  const [file, setFile]               = useState<File | null>(null)
  const [fileError, setFileError]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [justSent, setJustSent]       = useState(false)

  /* ── Histórico ── */
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['feedbacks', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('feedbacks') as any)
        .select('id, type, subject, status, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  function resetForm() {
    setType('')
    setSubject('')
    setMessage('')
    setPriority('normal')
    setAllowContact(false)
    setFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(f: File | null) {
    setFileError('')
    if (!f) { setFile(null); return }
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_FILE_EXTS.includes(ext)) {
      setFileError('Formato não permitido. Use imagem (jpg, png, webp, gif) ou PDF.')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError('Arquivo muito grande. Máximo 10MB.')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(f)
  }

  const messageLen = message.length
  const messageValid = messageLen >= MESSAGE_MIN && messageLen <= MESSAGE_MAX
  const canSubmit = !!type && subject.trim().length > 0 && messageValid && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('type', type)
      formData.append('subject', subject.trim())
      formData.append('message', message.trim())
      formData.append('priority', priority)
      formData.append('allow_contact', String(allowContact))
      if (file) formData.append('file', file)

      const res = await fetch('/api/feedback', { method: 'POST', body: formData })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(body?.error || 'Erro ao enviar feedback')
      }

      resetForm()
      setJustSent(true)
      queryClient.invalidateQueries({ queryKey: ['feedbacks', companyId] })
      toast('success', 'Feedback enviado com sucesso!')
      setTimeout(() => setJustSent(false), 6000)
    } catch (err: any) {
      toast('error', err.message || 'Erro ao enviar feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-enter">
      <Header title="💬 Feedback" subtitle="Ajude a melhorar o Precy+. Envie sugestões, relate problemas ou compartilhe sua experiência." />

      <div className="p-3 sm:p-5 lg:p-6 space-y-5">

        {/* ── Cards rápidos ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {FEEDBACK_TYPES.map(t => {
            const active = type === t.value
            const Icon = t.icon
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1.5 p-3.5 sm:p-4 rounded-2xl border-2 transition-all text-center',
                  active
                    ? 'border-primary bg-primary-50 dark:bg-primary/10 shadow-sm'
                    : 'border-border dark:border-border-dark bg-white dark:bg-surface-dark hover:border-primary/40'
                )}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className={clsx('text-xs font-semibold', active ? 'text-primary' : 'text-text-secondary dark:text-stone-300')}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Mensagem de sucesso ── */}
        {justSent && (
          <div className="card flex items-start gap-3 border-green-200/60 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10">
            <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Feedback enviado com sucesso.</p>
              <p className="text-xs text-green-700/80 dark:text-green-400/70 mt-0.5">
                Obrigado por nos ajudar a melhorar o Precy+.
              </p>
            </div>
          </div>
        )}

        {/* ── Formulário ── */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Tipo <span className="text-error">*</span>
              </label>
              <select
                className="input"
                value={type}
                onChange={e => setType(e.target.value as FeedbackType)}
                required
              >
                <option value="" disabled>Selecione...</option>
                {FEEDBACK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                Prioridade <span className="text-text-muted font-normal">(opcional)</span>
              </label>
              <select
                className="input"
                value={priority}
                onChange={e => setPriority(e.target.value as 'baixa' | 'normal' | 'alta')}
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Assunto <span className="text-error">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="Resuma seu feedback em poucas palavras"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Mensagem <span className="text-error">*</span>
            </label>
            <textarea
              rows={6}
              className="input resize-none"
              placeholder="Conte com detalhes sua sugestão, o problema encontrado ou sua experiência..."
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              required
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-text-muted">
                {messageLen < MESSAGE_MIN
                  ? `Mínimo ${MESSAGE_MIN} caracteres (faltam ${MESSAGE_MIN - messageLen})`
                  : 'Mínimo atingido ✓'}
              </p>
              <p className={clsx('text-[10px]', messageLen > MESSAGE_MAX ? 'text-error' : 'text-text-muted')}>
                {messageLen}/{MESSAGE_MAX}
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={allowContact}
              onChange={e => setAllowContact(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border dark:border-border-dark text-primary focus:ring-primary flex-shrink-0"
            />
            <span className="text-xs text-text-secondary dark:text-stone-400">
              Aceito que a equipe entre em contato caso precise de mais informações.
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Anexo <span className="text-text-muted font-normal">(opcional — imagem ou PDF, máx. 10MB)</span>
            </label>
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border dark:border-border-dark text-text-muted hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium"
              >
                <Paperclip size={14} /> Selecionar arquivo
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border dark:border-border-dark bg-stone-50 dark:bg-stone-800/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip size={14} className="text-primary flex-shrink-0" />
                  <span className="text-xs text-text-primary dark:text-stone-200 truncate">{file.name}</span>
                  <span className="text-[10px] text-text-muted flex-shrink-0">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error-light flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {fileError && <p className="text-xs text-error mt-1.5">{fileError}</p>}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? 'Enviando...' : 'Enviar feedback'}
            </button>
          </div>
        </form>

        {/* ── Histórico ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
            <History size={15} className="text-primary" /> Seus feedbacks enviados
          </h2>

          {historyLoading ? (
            <div className="card"><SkeletonTable /></div>
          ) : (history ?? []).length === 0 ? (
            <div className="card text-center py-10">
              <MessageSquare size={28} className="mx-auto text-text-muted opacity-30 mb-2" />
              <p className="text-sm text-text-muted">Você ainda não enviou nenhum feedback.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border dark:border-border-dark overflow-x-auto bg-white dark:bg-surface-dark shadow-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50 text-[10px] uppercase tracking-wide text-text-muted border-b border-border dark:border-border-dark">
                    <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Tipo</th>
                    <th className="text-left font-semibold px-3 py-2.5">Assunto</th>
                    <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Data</th>
                    <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((f: any, idx: number) => {
                    const meta = FEEDBACK_TYPES.find(t => t.value === f.type)
                    const status = STATUS_META[f.status] ?? STATUS_META.novo
                    return (
                      <tr key={f.id} className={clsx(idx !== 0 && 'border-t border-border dark:border-border-dark')}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-text-secondary dark:text-stone-300">
                            {meta?.emoji} {meta?.label ?? f.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[280px] truncate text-text-primary dark:text-stone-100" title={f.subject}>
                          {f.subject}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                          {format(parseISO(f.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.cls)}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
