import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Config mínima: só cobre as funções puras (lib/**) que não dependem de
 * Next.js/Supabase em runtime (cálculo de taxas, parcelamento). Rotas de
 * API e componentes React ficam fora — exigiriam mocks pesados do
 * Supabase/Mercado Pago para rodar de forma confiável em CI.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
