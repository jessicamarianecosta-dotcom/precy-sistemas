import { describe, it, expect } from 'vitest'
import {
  toCents, fromCents, computeGrossCents, computeGrossAmount, computeFeeAmount,
  splitInstallmentsCents, buildInstallmentBreakdown,
} from './feeCalculator'

describe('toCents / fromCents', () => {
  it('converte reais para centavos sem erro de ponto flutuante', () => {
    expect(toCents(30)).toBe(3000)
    expect(toCents(30.1)).toBe(3010)
    expect(toCents(0.1 + 0.2)).toBe(30) // 0.1+0.2 = 0.30000000000000004 em float puro
  })
  it('é a inversa de computeGrossCents/toCents', () => {
    expect(fromCents(3125)).toBe(31.25)
  })
})

describe('computeGrossCents / computeGrossAmount — fórmula do bruto', () => {
  it('reproduz o exemplo do enunciado: R$30 líquido, 4% de taxa → R$31,25 bruto', () => {
    const gross = computeGrossAmount(30, { feePercent: 0.04, feeFixed: 0 })
    expect(gross).toBe(31.25)
  })

  it('bruto cobrado menos a taxa percentual sobre ele mesmo reproduz o líquido original', () => {
    const rule = { feePercent: 0.0499, feeFixed: 0 }
    const gross = computeGrossAmount(30, rule)
    const net = gross - gross * rule.feePercent
    expect(net).toBeCloseTo(30, 2)
  })

  it('soma taxa fixa + percentual corretamente', () => {
    // bruto = (100 + 0.39) / (1 - 0.0649) = 107.35...
    const gross = computeGrossAmount(100, { feePercent: 0.0649, feeFixed: 0.39 })
    expect(gross).toBeCloseTo(107.36, 2)
  })

  it('taxa zero devolve o próprio valor líquido', () => {
    expect(computeGrossAmount(50, { feePercent: 0, feeFixed: 0 })).toBe(50)
  })

  it('rejeita taxa percentual fora do intervalo [0,1)', () => {
    expect(() => computeGrossCents(1000, { feePercent: 1, feeFixed: 0 })).toThrow()
    expect(() => computeGrossCents(1000, { feePercent: -0.1, feeFixed: 0 })).toThrow()
  })

  it('rejeita taxa fixa negativa', () => {
    expect(() => computeGrossCents(1000, { feePercent: 0.05, feeFixed: -1 })).toThrow()
  })
})

describe('computeFeeAmount', () => {
  it('é exatamente a diferença entre bruto e líquido', () => {
    expect(computeFeeAmount(31.25, 30)).toBe(1.25)
  })
})

describe('splitInstallmentsCents — nunca perde nem cria centavo', () => {
  it('divide igualmente quando é exato', () => {
    expect(splitInstallmentsCents(300, 3)).toEqual([100, 100, 100])
  })

  it('distribui o resto nas primeiras parcelas e a soma bate exatamente', () => {
    const parts = splitInstallmentsCents(1000, 3) // 333.33... → 334+333+333
    expect(parts).toEqual([334, 333, 333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it('funciona com 1 parcela', () => {
    expect(splitInstallmentsCents(1999, 1)).toEqual([1999])
  })

  it('rejeita número de parcelas inválido', () => {
    expect(() => splitInstallmentsCents(1000, 0)).toThrow()
    expect(() => splitInstallmentsCents(1000, -1)).toThrow()
    expect(() => splitInstallmentsCents(1000, 1.5)).toThrow()
  })
})

describe('buildInstallmentBreakdown', () => {
  it('1x sem taxa: parcela e total iguais ao líquido', () => {
    const b = buildInstallmentBreakdown(30, 1, { feePercent: 0, feeFixed: 0 })
    expect(b).toEqual({ installments: 1, installmentAmount: 30, totalAmount: 30, feeAmount: 0 })
  })

  it('3x com taxa: total sempre maior que o líquido (taxa repassada), nunca igual', () => {
    const b = buildInstallmentBreakdown(100, 3, { feePercent: 0.0749, feeFixed: 0 })
    expect(b.totalAmount).toBeGreaterThan(100)
    expect(b.feeAmount).toBeCloseTo(b.totalAmount - 100, 2)
    // a soma de 3 parcelas iguais à exibida (ou com 1 centavo de diferença) reproduz o total
    expect(b.installmentAmount * 3).toBeCloseTo(b.totalAmount, 1)
  })

  it('taxas diferentes por número de parcelas nunca são confundidas', () => {
    const b2 = buildInstallmentBreakdown(100, 2, { feePercent: 0.0649, feeFixed: 0 })
    const b3 = buildInstallmentBreakdown(100, 3, { feePercent: 0.0749, feeFixed: 0 })
    expect(b2.totalAmount).not.toBe(b3.totalAmount)
    expect(b3.totalAmount).toBeGreaterThan(b2.totalAmount)
  })
})
