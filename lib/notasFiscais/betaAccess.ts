/**
 * Notas Fiscais (emissão via Bling): beta privado, liberado só para a
 * conta de jessicamarianecosta@gmail.com.
 *
 * Diferente do beta do Catálogo Online (lib/catalog/betaAccess.ts, que
 * compara e-mail), aqui comparamos pelo ID estável do Supabase Auth —
 * pedido explícito do escopo deste módulo, pra não depender só do e-mail
 * que o client informa. O e-mail de uma conta pode mudar; o UUID do
 * usuário autenticado (auth.users.id / profiles.id), não. Função pura —
 * funciona igual em Client Component, Server Component, middleware (Edge)
 * e route handler, mesma forma de uso do canAccessCatalog.
 *
 * Esse ID não é segredo (é só um identificador), mas a checagem em si só
 * vale alguma coisa quando `userId` vem do lado servidor (sessão validada
 * pelo Supabase, nunca de um valor que o próprio client pudesse mandar) —
 * ver lib/notasFiscais/server-auth.ts e middleware.ts, que sempre resolvem
 * o ID a partir da sessão, nunca de query string/body.
 */
const BETA_USER_ID = '8ffae780-1ed8-4528-b12d-a92769ed28c8' // jessicamarianecosta@gmail.com

export function canAccessNotasFiscais(userId: string | null | undefined): boolean {
  return !!userId && userId === BETA_USER_ID
}
