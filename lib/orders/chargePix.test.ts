import { describe, it, expect } from 'vitest'
import { missingCompanyPixFields, buildChargePixSnapshot } from './chargePix'

describe('missingCompanyPixFields', () => {
  it('não reporta nada faltando quando a empresa tem chave Pix configurada', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', pix_type: 'cnpj', pix_key: '12345678000195', city: 'Curitiba' })).toEqual([])
  })

  it('aceita qualquer tipo de chave Pix (não exige CNPJ válido)', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', pix_type: 'email', pix_key: 'contato@lumilife.com', city: null })).toEqual([])
    expect(missingCompanyPixFields({ name: 'LumiLife', pix_type: 'telefone', pix_key: '41999998888', city: null })).toEqual([])
  })

  it('aponta a chave Pix faltando quando ausente ou em branco', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', pix_key: null, city: 'Curitiba' })).toContain('Chave Pix (Dados de pagamento)')
    expect(missingCompanyPixFields({ name: 'LumiLife', pix_key: '   ', city: 'Curitiba' })).toContain('Chave Pix (Dados de pagamento)')
    expect(missingCompanyPixFields(null)).toContain('Chave Pix (Dados de pagamento)')
  })
})

describe('buildChargePixSnapshot', () => {
  it('monta o snapshot usando a chave Pix configurada pela empresa', () => {
    const snap = buildChargePixSnapshot({ name: 'LumiLife', pix_type: 'cnpj', pix_key: '53115013000172', city: 'Curitiba' })
    expect(snap.pix_type).toBe('cnpj')
    expect(snap.pix_key).toBe('53115013000172')
    expect(snap.pix_label).toBe('LumiLife')
  })

  it('usa pix_label específico quando configurado, em vez do nome da empresa', () => {
    const snap = buildChargePixSnapshot({ name: 'LumiLife', pix_type: 'cnpj', pix_key: '53115013000172', pix_label: 'Lumilife Gráfica' })
    expect(snap.pix_label).toBe('Lumilife Gráfica')
  })

  it('nunca inventa dado: lança erro claro quando falta a chave Pix', () => {
    expect(() => buildChargePixSnapshot({ name: '', pix_key: null, city: null })).toThrowError(/Chave Pix/)
  })
})
