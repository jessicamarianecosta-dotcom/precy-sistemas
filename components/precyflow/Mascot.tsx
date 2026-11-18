/* Mascote do tema Cat, reconstruído em SVG a partir da descrição do guia de
   marca (gatinho branco, contorno marrom-escuro, laço rosa, olhos fechados
   sorridentes, bochechas rosadas) — os PNGs oficiais da biblioteca local
   ("Área de Trabalho/PrecyFlow") não estavam disponíveis neste ambiente.
   Basta trocar este arquivo por um <Image> apontando para o PNG real
   quando os assets forem enviados ao projeto (ex: public/precyflow/). */
export function Mascot({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Mascote PrecyFlow"
    >
      <path d="M18 14 L22 26 L14 24 Z" fill="#FFFFFF" stroke="#4A2E3A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M46 14 L42 26 L50 24 Z" fill="#FFFFFF" stroke="#4A2E3A" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="34" r="20" fill="#FFFFFF" stroke="#4A2E3A" strokeWidth="2" />
      <path d="M22 44c2 2 6 3 10 3s8-1 10-3" stroke="#4A2E3A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M22 32c1.5 1.5 3.5 1.5 5 0" stroke="#4A2E3A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M37 32c1.5 1.5 3.5 1.5 5 0" stroke="#4A2E3A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M32 36l-1.5 2h3z" fill="#4A2E3A" />
      <circle cx="21" cy="40" r="3" fill="#F6B7CE" opacity="0.8" />
      <circle cx="43" cy="40" r="3" fill="#F6B7CE" opacity="0.8" />
      <g transform="translate(26 8)">
        <path d="M0 4 L6 0 L6 8 Z" fill="#D6447D" stroke="#4A2E3A" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 4 L6 0 L6 8 Z" fill="#D6447D" stroke="#4A2E3A" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="6" cy="4" r="2" fill="#D6447D" stroke="#4A2E3A" strokeWidth="1.5" />
      </g>
    </svg>
  )
}
