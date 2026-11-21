import { describe, it, expect } from 'vitest'
import { getOrderItems } from './getOrderItems'

describe('getOrderItems', () => {
  it('usa os itens reais de order_items quando existem', () => {
    const order = { order_number: 'PED-0001', total: 150 }
    const dbItems = [
      { name: 'Banner 2x1m', description: 'Lona 440g', quantity: 1, unit_price: 100, subtotal: 100 },
      { name: 'Adesivo', description: null, quantity: 5, unit_price: 10, subtotal: 50 },
    ]
    const items = getOrderItems(order, dbItems)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'Banner 2x1m', description: 'Lona 440g', quantity: 1, unit_price: 100, subtotal: 100 })
    expect(items[1]).toMatchObject({ name: 'Adesivo', description: '', quantity: 5, unit_price: 10, subtotal: 50 })
  })

  it('inclui a variação escolhida na descrição mesmo quando a descrição foi editada depois', () => {
    const order = { order_number: 'PED-0002', total: 30 }
    const dbItems = [{ name: 'Camiseta', description: 'Algodão', quantity: 1, unit_price: 30, subtotal: 30, variant_label: 'Tamanho M' }]
    const items = getOrderItems(order, dbItems)
    expect(items[0].description).toContain('Variação: Tamanho M')
    expect(items[0].description).toContain('Algodão')
  })

  it('cria um item sintético (fallback) para pedido legado sem order_items, usando dados reais do pedido', () => {
    const order = { order_number: 'PED-0003', service_name: 'Cartão de visita', description: 'Verniz localizado', total: 80, subtotal: 80 }
    const items = getOrderItems(order, [])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ name: 'Cartão de visita', description: 'Verniz localizado', quantity: 1, unit_price: 80, subtotal: 80 })
  })

  it('não inventa item quando o pedido não tem itens nem valor', () => {
    const order = { order_number: 'PED-0004', total: 0, subtotal: 0 }
    expect(getOrderItems(order, [])).toEqual([])
  })
})
