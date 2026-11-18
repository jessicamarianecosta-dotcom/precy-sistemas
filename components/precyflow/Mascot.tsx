import Image from 'next/image'

/* Mascote oficial do tema Cat (enviado pela dona da marca, pasta
   15_Landing_Page/Mascote) — public/precyflow/mascote.webp. */
export function Mascot({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/precyflow/mascote.webp"
      alt="Mascote PrecyFlow"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      unoptimized
    />
  )
}
