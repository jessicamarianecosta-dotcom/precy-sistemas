import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
export const DIGITAL_ART_APPROVAL_BETA_EMAIL = 'jessicamarianecosta@gmail.com'
export const ART_APPROVAL_CONSENT_TEXT = "Declaro que analisei e conferi todos os detalhes da arte apresentada, incluindo textos, cores, medidas, informações e posicionamento dos elementos. Estou ciente de que, após a aprovação, a LumiLife não se responsabiliza por erros ortográficos, erros nas imagens ou diferenças de cores identificados na arte aprovada. Também estou ciente das possíveis variações de impressão, tonalidade, posicionamento e medidas de até 5% no produto final, das limitações de leitura de QR Codes fornecidos pelo cliente e das condições descritas nas orientações de acabamento. Autorizo a produção conforme esta versão aprovada."
export const ART_FINISHING_INSTRUCTIONS_VERSION = 'lumilife-aprovacao-arte-v2'
export const ART_FINISHING_INSTRUCTIONS = "APROVAÇÃO DE ARTE E ACABAMENTO — LUMILIFE\n\nANALISE E VERIFIQUE ANTES DE APROVAR!\n\nConfira todos os detalhes da sua arte com atenção: texto, cores, medidas, informações e posicionamento dos elementos.\n\nAPÓS A APROVAÇÃO NÃO NOS RESPONSABILIZAMOS POR:\n• Erros ortográficos.\n• Erros na imagem.\n• Diferença nas cores.\n\nARQUIVOS ENVIADOS\nImagens criadas por Inteligência Artificial podem apresentar baixa qualidade, distorções ou imperfeições. Realizamos ajustes básicos para impressão, porém a qualidade final dependerá do arquivo original enviado.\n\nPADRÃO DE CORES\nAs cores exibidas na tela podem apresentar pequenas variações quando impressas, devido à diferença entre os padrões RGB e CMYK.\n\nPEQUENAS VARIAÇÕES\nPode haver variações de tonalidade, posicionamento e medidas de até 5% no produto final.\n\nQR CODE\nA leitura do QR Code pode variar conforme a qualidade do arquivo, impressão, tamanho aplicado e condições do aparelho utilizado para leitura. Não nos responsabilizamos por falhas na leitura de QR Codes fornecidos pelo cliente. Recomendamos a conferência e teste antes da aprovação final.\n\nCONFERÊNCIA É ESSENCIAL\nVerifique todos os dados, medidas, textos e elementos antes de aprovar. Sua aprovação confirma que está tudo correto conforme desejado.\n\nA aprovação confirma a autorização para produzir conforme a arte e as especificações conferidas nesta página."
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
