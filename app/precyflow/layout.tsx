import type { Metadata } from 'next'
import '@/styles/precyflow.css'

export const metadata: Metadata = {
  title: {
    default: 'PrecyFlow',
    template: '%s | PrecyFlow',
  },
  description: 'Gestão simples para ateliês e pequenos negócios: catálogo, materiais, pedidos, clientes, orçamentos, caixa, estoque e atendimento online.',
}

export default function PrecyFlowRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
