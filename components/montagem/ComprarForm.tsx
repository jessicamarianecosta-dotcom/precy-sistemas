'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export function ComprarForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/montagem/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.redirectUrl) {
        setError(data.error ?? 'Não foi possível iniciar o pagamento.')
        setBusy(false)
        return
      }
      window.location.href = data.redirectUrl
    } catch {
      setError('Falha de conexão. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Nome</label>
        <input
          required
          className="input mt-1 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">E-mail</label>
        <input
          required
          type="email"
          className="input mt-1 w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary dark:text-stone-400">Telefone (opcional)</label>
        <input
          type="tel"
          inputMode="tel"
          className="input mt-1 w-full"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Rótulo curto de propósito: o botão força white-space: nowrap
         (globals.css), então um texto como "Pagar R$ 27,00 e liberar
         acesso" vazava pra fora da borda em telas estreitas de celular —
         o preço já aparece destacado acima, no card da página. */}
      <button type="submit" disabled={busy} className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? 'Processando…' : 'Pagar e liberar acesso'}
      </button>
      <p className="text-[11px] text-text-muted text-center">
        Pagamento processado pelo Mercado Pago (Pix, cartão ou boleto). Acesso liberado automaticamente assim que o pagamento for confirmado.
      </p>
    </form>
  )
}
