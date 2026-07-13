'use client'

import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

export function ContactInfoCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Phone size={17} className="text-primary" /> Contato
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Essas informações serão exibidas na sua loja.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <input className="input text-sm" placeholder="Telefone" value={value.phone ?? ''} onChange={e => onChange({ phone: e.target.value })} />
        <input className="input text-sm" placeholder="WhatsApp" value={value.whatsapp ?? ''} onChange={e => onChange({ whatsapp: e.target.value })} />
        <div className="relative sm:col-span-2">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input pl-9 text-sm" placeholder="E-mail" type="email" value={value.email ?? ''} onChange={e => onChange({ email: e.target.value })} />
        </div>
        <input className="input text-sm" placeholder="Cidade" value={value.city ?? ''} onChange={e => onChange({ city: e.target.value })} />
        <input className="input text-sm" placeholder="Estado (UF)" maxLength={2} value={value.state ?? ''} onChange={e => onChange({ state: e.target.value.toUpperCase() })} />
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input pl-9 text-sm" placeholder="CEP" value={value.zip_code ?? ''} onChange={e => onChange({ zip_code: e.target.value })} />
        </div>
        <div className="relative">
          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className="input pl-9 text-sm" placeholder="Horário de atendimento" value={value.business_hours ?? ''} onChange={e => onChange({ business_hours: e.target.value })} />
        </div>
      </div>
    </div>
  )
}
