/**
 * Gate da função "Importar Catálogo" (Produtos): exclusiva desta conta,
 * mesmo padrão de comparação direta por e-mail usado no Painel Admin
 * (ver middleware.ts, app/admin/layout.tsx). Função pura — funciona igual
 * em Client Component e Server Component/route handler, sem depender de
 * rede nem de flag no banco. A checagem que realmente importa (server-side,
 * antes de processar/criar/atualizar produtos) fica em importServerAuth.ts;
 * este arquivo só decide se a UI mostra o botão/tela.
 */
const CATALOG_IMPORT_ADMIN_EMAIL = 'jessicamarianecosta@gmail.com'

export function isCatalogImportAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false
  return userEmail.toLowerCase() === CATALOG_IMPORT_ADMIN_EMAIL
}
