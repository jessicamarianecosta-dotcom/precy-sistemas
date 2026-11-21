import { describe, it, expect } from 'vitest'
import { computeCustomerChargeDisplay } from './customerCharges'

describe('computeCustomerChargeDisplay', () => {
  it('soma o saldo de vários pedidos em aberto do mesmo cliente', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 300,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 0, orderStatus: 'em_andamento' },
        { orderId: '2', orderNumber: '002', serviceName: 'Banner', total: 200, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.amountDue).toBe(300)
    expect(d.status).toBe('pendente')
    expect(d.isSettled).toBe(false)
  })

  it('exclui da soma pedidos já quitados, sem removê-los da discriminação', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 300,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 100, orderStatus: 'em_andamento' },
        { orderId: '2', orderNumber: '002', serviceName: 'Banner', total: 200, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.amountDue).toBe(200)
    expect(d.orders.find(o => o.orderId === '1')?.settled).toBe(true)
    expect(d.orders.find(o => o.orderId === '1')?.balance).toBe(0)
    expect(d.orders.find(o => o.orderId === '2')?.balance).toBe(200)
  })

  it('exclui pedidos cancelados da soma mesmo sem recebimento registrado', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 300,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 0, orderStatus: 'cancelled' },
        { orderId: '2', orderNumber: '002', serviceName: 'Banner', total: 200, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.amountDue).toBe(200)
    expect(d.orders.find(o => o.orderId === '1')?.settled).toBe(true)
  })

  it('mostra paga quando todos os pedidos incluídos já foram quitados ou cancelados', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 300,
      chargeStatus: 'ativa',
      dueDate: '2020-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 100, orderStatus: 'em_andamento' },
        { orderId: '2', orderNumber: '002', serviceName: 'Banner', total: 200, received: 0, orderStatus: 'cancelled' },
      ],
      today: '2026-11-20',
    })
    expect(d.status).toBe('paga')
    expect(d.amountDue).toBe(0)
    expect(d.isSettled).toBe(true)
  })

  it('mostra vencida quando o vencimento já passou e ainda há saldo', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'ativa',
      dueDate: '2020-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.status).toBe('vencida')
  })

  it('cobrança cancelada nunca aparece como cobrável, mesmo com saldo em aberto', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 100,
      chargeStatus: 'cancelada',
      dueDate: '2999-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.status).toBe('cancelada')
    expect(d.amountDue).toBe(0)
    expect(d.isSettled).toBe(true)
  })

  it('reflete pagamento parcial de um pedido dentro do total agregado', () => {
    const d = computeCustomerChargeDisplay({
      chargeAmount: 300,
      chargeStatus: 'ativa',
      dueDate: '2999-01-01',
      orders: [
        { orderId: '1', orderNumber: '001', serviceName: 'Cartões', total: 100, received: 40, orderStatus: 'em_andamento' },
        { orderId: '2', orderNumber: '002', serviceName: 'Banner', total: 200, received: 0, orderStatus: 'em_andamento' },
      ],
      today: '2026-11-20',
    })
    expect(d.amountDue).toBe(260)
    expect(d.orders.find(o => o.orderId === '1')?.balance).toBe(60)
  })
})
