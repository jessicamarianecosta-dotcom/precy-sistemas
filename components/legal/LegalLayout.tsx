import Link from 'next/link'

interface Props {
  title: string; subtitle: string; updated: string; version?: string; children: React.ReactNode
}

export function LegalLayout({ title, subtitle, updated, version, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: '#0F0B08', color: '#d4c4b4', fontFamily: "'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,11,8,0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#8B6C4F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>P+</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f0ece6' }}>Precy+</span>
          </Link>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[['Termos','/termos'],['Privacidade','/privacidade'],['Reembolso','/reembolso'],['Cancelamento','/cancelamento'],['Suporte','/suporte']].map(([l,h]) => (
              <Link key={h} href={h} style={{ fontSize: 12, color: '#7a6855', textDecoration: 'none' }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px 32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8B6C4F', marginBottom: 8 }}>{subtitle}</p>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: '#f0ece6', marginBottom: 10 }}>{title}</h1>
          <p style={{ fontSize: 13, color: '#6a5a4a' }}>
            Última atualização: {updated}
            {version && (
              <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: '#C4A47B', background: 'rgba(139,108,79,0.15)', padding: '2px 8px', borderRadius: 999 }}>
                Versão {version}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="legal-content">{children}</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
        <p style={{ fontSize: 12, color: '#4a3a2a' }}>
          © {new Date().getFullYear()} Precy+ Sistemas. Todos os direitos reservados.{' '}
          <a href="mailto:suporte@precyplus.com.br" style={{ color: '#6a5a4a' }}>suporte@precyplus.com.br</a>
        </p>
      </div>
    </div>
  )
}
