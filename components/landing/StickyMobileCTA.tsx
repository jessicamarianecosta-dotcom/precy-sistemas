'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * CTA fixo no rodapé, visível só em telas pequenas (mobile é onde a maior
 * parte do tráfego de anúncio chega). Some enquanto o herói ainda está
 * visível — o CTA do próprio herói já cobre esse trecho — e volta a
 * aparecer assim que a pessoa rola a página, sempre com a oferta principal
 * a um toque de distância.
 */
export function StickyMobileCTA() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 transition-transform duration-300"
      style={{
        transform: show ? 'translateY(0)' : 'translateY(120%)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <Link
        href="/cadastro"
        className="flex items-center justify-center gap-2 w-full text-sm font-semibold text-white py-3.5 rounded-2xl shadow-[0_8px_30px_rgba(139,108,79,0.45)]"
        style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}
      >
        ✨ Criar conta grátis — 7 dias
        <ArrowRight size={15} />
      </Link>
    </div>
  )
}
