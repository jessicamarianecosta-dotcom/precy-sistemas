import { describe, expect, it, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.PAYMENTS_ENCRYPTION_KEY = '0'.repeat(64)
  // licenseCascade.ts importa lib/supabase/admin.ts, que falha ao carregar
  // sem essas duas env vars (mesmo só pra usar montagemRef, que não toca no
  // banco) — valores fake bastam pro módulo só carregar.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder'
})

describe('accessCookie', () => {
  it('assina e verifica um token válido, não expirado', async () => {
    const { signMontagemAccess, verifyMontagemAccess } = await import('./accessCookie')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString()
    const token = signMontagemAccess({ licenseId: 'abc-123', email: 'a@b.com', expiresAt })
    const parsed = verifyMontagemAccess(token)
    expect(parsed).toEqual({ licenseId: 'abc-123', email: 'a@b.com', expiresAt })
  })

  it('rejeita um token já expirado', async () => {
    const { signMontagemAccess, verifyMontagemAccess } = await import('./accessCookie')
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    const token = signMontagemAccess({ licenseId: 'abc-123', email: 'a@b.com', expiresAt })
    expect(verifyMontagemAccess(token)).toBeNull()
  })

  it('rejeita um token adulterado (corpo ou assinatura alterados)', async () => {
    const { signMontagemAccess, verifyMontagemAccess } = await import('./accessCookie')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString()
    const token = signMontagemAccess({ licenseId: 'abc-123', email: 'a@b.com', expiresAt })
    // body e assinatura são base64url/HMAC — não há texto plano pra
    // substituir, então adultera trocando o último caractere de cada parte.
    const [body, sig] = token.split('.')
    const flipLastChar = (s: string) => s.slice(0, -1) + (s.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyMontagemAccess(`${flipLastChar(body)}.${sig}`)).toBeNull()
    expect(verifyMontagemAccess(`${body}.${flipLastChar(sig)}`)).toBeNull()
  })

  it('rejeita lixo que não é um token válido', async () => {
    const { verifyMontagemAccess } = await import('./accessCookie')
    expect(verifyMontagemAccess('nao-eh-um-token')).toBeNull()
  })
})

describe('montagemRef', () => {
  it('gera e reconhece a referência do Mercado Pago com o prefixo certo', async () => {
    const { montagemRef, MONTAGEM_REF_PREFIX } = await import('./licenseCascade')
    const ref = montagemRef('abc-123')
    expect(ref).toBe('montagem_abc-123')
    expect(ref.startsWith(MONTAGEM_REF_PREFIX)).toBe(true)
  })
})
