import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
export const DIGITAL_ART_APPROVAL_BETA_EMAIL = 'jessicamarianecosta@gmail.com'
export const ART_APPROVAL_CONSENT_TEXT = 'Declaro que conferi a prévia da arte e estou ciente de que a produção será realizada conforme a versão apresentada nesta página. Após a aprovação, alterações poderão exigir novo orçamento e prazo.'
export const ART_FINISHING_INSTRUCTIONS_VERSION = 'lumilife-acabamento-v1'
export const ART_FINISHING_INSTRUCTIONS = `ORIENTAÇÕES DE ACABAMENTO — LUMILIFE

Confira cuidadosamente a arte, textos, nomes, números, cores, medidas, quantidades e demais informações antes de aprovar.

A aprovação confirma que a versão visual apresentada está correta e autorizada para produção. A produção seguirá a arte aprovada e as especificações registradas no pedido.

Cores impressas podem apresentar pequenas variações em relação à visualização em telas, devido às diferenças de monitor, iluminação, material e processo de impressão.

Após a aprovação, qualquer alteração poderá exigir uma nova versão, novo prazo e eventual cobrança adicional. A equipe manterá o histórico das versões e das decisões.

Em caso de dúvida ou necessidade de ajuste, selecione “Solicitar alteração” e descreva claramente o que precisa ser corrigido.`
export function createApprovalToken(){const token=randomBytes(32).toString('base64url');return {token,tokenHash:createHash('sha256').update(token).digest('hex')}}
export function hashApprovalToken(token:string){return createHash('sha256').update(token).digest('hex')}
export function hasDigitalArtApprovalBeta(email?:string|null){return (email??'').trim().toLowerCase()===DIGITAL_ART_APPROVAL_BETA_EMAIL}

export function encryptApprovalToken(token:string){
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!secret) throw new Error('Chave de criptografia indisponível.')
 const key=createHash('sha256').update(secret).digest()
 const iv=randomBytes(12)
 const cipher=createCipheriv('aes-256-gcm',key,iv)
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()])
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.')
}
export function decryptApprovalToken(value:string){
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!secret) throw new Error('Chave de criptografia indisponível.')
 const [iv,tag,encrypted]=value.split('.')
 if(!iv||!tag||!encrypted) throw new Error('Token armazenado inválido.')
 const key=createHash('sha256').update(secret).digest()
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'))
 decipher.setAuthTag(Buffer.from(tag,'base64url'))
 return Buffer.concat([decipher.update(Buffer.from(encrypted,'base64url')),decipher.final()]).toString('utf8')
}
