/**
 * Feature flag do Catálogo Online (beta privado): só as contas listadas
 * aqui podem ver e usar o módulo enquanto ele não é liberado para todo
 * mundo. Função pura — funciona igual em Client Component, Server
 * Component, middleware (Edge) e route handler, sem depender de env var
 * nem de chamada de rede. Para liberar mais gente, só adicionar o e-mail
 * na lista abaixo.
 */
const CATALOG_BETA_USERS = [
  'jessicamarianecosta@gmail.com',
]

export function canAccessCatalog(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false
  return CATALOG_BETA_USERS.includes(userEmail.toLowerCase())
}
