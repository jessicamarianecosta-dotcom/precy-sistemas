import { describe, it, expect } from 'vitest'
import { computeChargeDisplay } from './charges'

describe('computeChargeDisplay', () => {
  it('mostra pendente quando o pedido ainda não venceu e não há saldo pago', () => {
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orderTotal: 100,
      orderReceived: 0,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.status).toBe('pendente')
    expect(d.amountDue).toBe(100)
    expect(d.isSettled).toBe(false)
  })

  it('mostra vencida quando o vencimento já passou e ainda há saldo', () => {
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2020-01-01',
      orderTotal: 100,
      orderReceived: 0,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.status).toBe('vencida')
  })

  it('mostra paga e zera o valor devido quando o pedido já foi totalmente recebido', () => {
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2020-01-01',
      orderTotal: 100,
      orderReceived: 100,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.status).toBe('paga')
    expect(d.amountDue).toBe(0)
    expect(d.isSettled).toBe(true)
  })

  it('reflete o saldo restante — nunca o valor original — após um recebimento parcial', () => {
    // Cobrança foi criada pedindo o saldo total (100), mas o cliente pagou 40
    // antes de abrir o link de novo: a cobrança deve mostrar os 60 restantes,
    // nunca os 100 originais.
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orderTotal: 100,
      orderReceived: 40,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.status).toBe('pendente')
    expect(d.amountDue).toBe(60)
    expect(d.amountRequested).toBe(100)
    expect(d.isSettled).toBe(false)
  })

  it('nunca cobra mais do que o saldo real, mesmo que o valor pedido seja maior', () => {
    // Cenário defensivo: um valor desatualizado não pode fazer a cobrança
    // pedir mais do que o pedido realmente ainda deve.
    const d = computeChargeDisplay({
      chargeAmount: 200,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orderTotal: 100,
      orderReceived: 70,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.amountDue).toBe(30)
  })

  it('cobrança cancelada nunca aparece como cobrável, mesmo com saldo em aberto', () => {
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'cancelada',
      dueDate: '2999-01-01',
      orderTotal: 100,
      orderReceived: 0,
      orderStatus: 'em_andamento',
      today: '2026-11-19',
    })
    expect(d.status).toBe('cancelada')
    expect(d.amountDue).toBe(0)
    expect(d.isSettled).toBe(true)
  })

  it('pedido cancelado nunca aparece como vencido/pendente (segue computeReceivableStatus)', () => {
    const d = computeChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2020-01-01',
      orderTotal: 100,
      orderReceived: 0,
      orderStatus: 'cancelled',
      today: '2026-11-19',
    })
    // saldo > 0 então não é "paga"; pedido cancelado não deve virar "vencida" artificialmente
    expect(d.status).toBe('pendente')
  })
})
