import Image from 'next/image'

/* Wordmark oficial (enviado pela dona da marca, pasta 15_Landing_Page/Logos)
   — public/precyflow/wordmark.png, 1100x280, já inclui "GESTÃO INTELIGENTE"
   desenhado na própria imagem. `subtitle=false` só reduz a largura exibida
   (contextos compactos como a sidebar), não recorta o subtítulo — ele faz
   parte do arquivo. */
export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  const width = subtitle ? 180 : 130
  const height = Math.round(width * (280 / 1100))

  return (
    <Image
      src="/precyflow/wordmark.png"
      alt="PrecyFlow"
      width={width}
      height={height}
      className={className}
      unoptimized
    />
  )
}
