/* Wordmark do PrecyFlow reconstruído em texto a partir da referência visual
   (PDF, pág. 1 e 3): "Precy" em marrom-escuro + "Flow" em rosa, com
   "GESTÃO INTELIGENTE" como subtítulo. O PNG transparente oficial do logo
   não estava disponível neste ambiente — trocar por <Image> quando o
   arquivo real (precyflow-wordmark-transparente.png) for enviado. */
export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={className}>
      <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--pf-text)' }}>
        Precy<span style={{ color: 'var(--pf-primary)' }}>Flow</span>
      </span>
      {subtitle && (
        <div className="text-[10px] font-semibold tracking-widest" style={{ color: 'var(--pf-text-secondary)' }}>
          GESTÃO INTELIGENTE
        </div>
      )}
    </div>
  )
}
