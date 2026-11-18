/**
 * Catálogo Online (Vitrine Virtual): liberado para Basic e Essencial.
 * O Pro NÃO tem acesso a este módulo — vai ganhar, no futuro, a loja
 * redesenhada do projeto "reformulação da loja LumiLife" (módulo
 * separado, decisão comercial da Jessica em 18/11).
 *
 * `userEmail` continua tendo acesso incondicional (fallback de admin,
 * igual já era no beta): útil para testar a conta sem depender do
 * plano atual. Função pura — funciona igual em Client Component,
 * Server Component, middleware (Edge) e route handler.
 */
const ADMIN_FALLBACK_EMAIL = 'jessicamarianecosta@gmail.com'

export function canAccessCatalog(
  userEmail: string | null | undefined,
  plan?: string | null,
): boolean {
  if (userEmail && userEmail.toLowerCase() === ADMIN_FALLBACK_EMAIL) return true
  return plan === 'basic' || plan === 'essencial'
}
