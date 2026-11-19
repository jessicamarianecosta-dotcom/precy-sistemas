import { describe, it, expect } from 'vitest'
import { missingCompanyPixFields, buildChargePixSnapshot } from './chargePix'

describe('missingCompanyPixFields', () => {
  it('não reporta nada faltando quando CNPJ, cidade e nome estão presentes', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', cnpj: '12.345.678/0001-95', city: 'Curitiba' })).toEqual([])
  })

  it('aponta CNPJ faltando quando ausente ou com tamanho inválido', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', cnpj: null, city: 'Curitiba' })).toContain('CNPJ')
    expect(missingCompanyPixFields({ name: 'LumiLife', cnpj: '123', city: 'Curitiba' })).toContain('CNPJ')
  })

  it('aponta cidade faltando quando ausente', () => {
    expect(missingCompanyPixFields({ name: 'LumiLife', cnpj: '12345678000195', city: null })).toContain('Cidade')
  })
})

describe('buildChargePixSnapshot', () => {
  it('monta o snapshot usando o CNPJ (só dígitos) como chave Pix', () => {
    const snap = buildChargePixSnapshot({ name: 'LumiLife', cnpj: '12.345.678/0001-95', city: 'Curitiba' })
    expect(snap.pix_type).toBe('cnpj')
    expect(snap.pix_key).toBe('12345678000195')
    expect(snap.pix_label).toBe('LumiLife')
  })

  it('nunca inventa dado: lança erro claro quando falta CNPJ/cidade/nome', () => {
    expect(() => buildChargePixSnapshot({ name: '', cnpj: null, city: null })).toThrowError(/CNPJ/)
  })
})
