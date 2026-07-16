/**
 * Fonte única de versão dos documentos legais. A versão vive aqui, ao lado
 * do texto (app/termos/page.tsx e app/privacidade/page.tsx) — bumpar a
 * versão é editar este arquivo + o texto do documento no mesmo commit/deploy,
 * nunca uma ação isolada de admin: mudar o número sem atualizar o texto de
 * verdade seria juridicamente incoerente.
 *
 * Quando qualquer uma das duas mudar, todo usuário com aceite de versão
 * antiga é bloqueado no próximo login (ver middleware.ts) até re-aceitar em
 * /termos/reaceite.
 */
export const TERMS_VERSION = '1.0'
export const PRIVACY_VERSION = '1.0'

export const TERMS_UPDATED_AT = 'Julho de 2026'
export const PRIVACY_UPDATED_AT = 'Julho de 2026'
