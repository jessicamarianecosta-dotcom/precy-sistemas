import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ART_APPROVAL_CONSENT_TEXT } from '@/lib/orders/digitalArtApproval'
const hash=(token:string)=>createHash('sha256').update(token).digest('hex')
async function getLink(token:string){
 if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
 const db=supabaseAdmin as any
 const {data}=await db.from('order_art_approval_links').select('*').eq('token_hash',hash(token)).maybeSingle()
 if(!data||data.revoked_at||data.status==='cancelada') return null
 return data
}
export async function GET(_req:Request,context:{params:Promise<{token:string}>}){
 try{
  const {token}=await context.params
  const db=supabaseAdmin as any; const link=await getLink(token)
  if(!link) return NextResponse.json({error:'Link indisponível.'},{status:404})
  const {data:version}=await db.from('order_art_approval_versions').select('*').eq('link_id',link.id).eq('version_number',link.current_version).maybeSingle()
  if(!version) return NextResponse.json({error:'Versão não encontrada.'},{status:404})
  const [{data:order},{data:item},{data:company},{data:response}]=await Promise.all([
   db.from('orders').select('order_number,due_date,customers(name)').eq('id',link.order_id).single(),
   db.from('order_items').select('name,description,quantity,width,height,measurement_unit,finishings,technical_notes').eq('id',link.order_item_id).single(),
   db.from('companies').select('name,logo_url').eq('id',link.company_id).single(),
   db.from('order_art_approval_responses').select('response,customer_note,created_at').eq('version_id',version.id).maybeSingle()
  ])
  const files=[]
  for(let i=0;i<(version.private_file_paths??[]).length;i++){
   const path=version.private_file_paths[i]
   const {data,error}=await supabaseAdmin.storage.from('art-approvals').createSignedUrl(path,3600)
   if(error) throw error
   const original=(version.file_ids??[])[i]
   const {data:file}=await db.from('order_files').select('file_name,mime_type').eq('id',original).maybeSingle()
   files.push({id:String(i),file_name:file?.file_name??'Arquivo de arte',mime_type:file?.mime_type??null,url:data.signedUrl})
  }
  return NextResponse.json({company:{name:company?.name,logoUrl:company?.logo_url},order:{number:order?.order_number,deadline:link.deadline??order?.due_date},customer:{name:order?.customers?.name},item,files,notes:version.public_notes??link.public_notes,instructions:version.instructions_text,instructionsVersion:version.instructions_version,version:version.version_number,status:link.status,response,consentText:ART_APPROVAL_CONSENT_TEXT})
 }catch(e){console.error('[public art approval:get]',e);return NextResponse.json({error:'Falha ao carregar aprovação.'},{status:500})}
}
export async function POST(req:Request,context:{params:Promise<{token:string}>}){
 try{
  const {token}=await context.params
  const link=await getLink(token)
  if(!link) return NextResponse.json({error:'Link indisponível.'},{status:404})
  if(link.status==='aprovada') return NextResponse.json({error:'Esta arte já foi aprovada.'},{status:409})
  const body=await req.json(); const action=body.action
  const note=String(body.note??'').trim().slice(0,3000)
  if(body.consent!==true) return NextResponse.json({error:'É necessário confirmar a leitura das orientações.'},{status:400})
  if(!['approve','request_changes'].includes(action)) return NextResponse.json({error:'Resposta inválida.'},{status:400})
  if(action==='request_changes'&&!note) return NextResponse.json({error:'Descreva a alteração desejada.'},{status:400})
  const db=supabaseAdmin as any
  const {data:version}=await db.from('order_art_approval_versions').select('id,status').eq('link_id',link.id).eq('version_number',link.current_version).single()
  if(!version||version.status!=='aguardando_aprovacao') return NextResponse.json({error:'Esta versão já recebeu uma resposta.'},{status:409})
  const response=action==='approve'?'aprovada':'alteracao_solicitada'
  const {error}=await db.from('order_art_approval_responses').insert({version_id:version.id,response,customer_name:String(body.customerName??'').trim().slice(0,160)||null,customer_note:note||null,consent_text:ART_APPROVAL_CONSENT_TEXT,consented_at:new Date().toISOString(),ip_address:req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??null,user_agent:req.headers.get('user-agent')})
  if(error){if(error.code==='23505') return NextResponse.json({error:'Esta versão já recebeu uma resposta.'},{status:409});throw error}
  const status=action==='approve'?'aprovada':'alteracao_solicitada'
  await db.from('order_art_approval_versions').update({status}).eq('id',version.id).eq('status','aguardando_aprovacao')
  await db.from('order_art_approval_links').update({status,updated_at:new Date().toISOString()}).eq('id',link.id).eq('status','aguardando_aprovacao')
  await db.from('order_items').update({art_approval_status:action==='approve'?'approved':'revision_requested',updated_at:new Date().toISOString()}).eq('id',link.order_item_id)
  await db.from('order_art_events').insert({order_id:link.order_id,company_id:link.company_id,event_type:action==='approve'?'arte_aprovada_cliente':'arte_alteracao_solicitada_cliente',description:action==='approve'?'Cliente aprovou a arte pelo link público.':`Cliente solicitou alteração: ${note}`})
  return NextResponse.json({ok:true,status})
 }catch(e){console.error('[public art approval:post]',e);return NextResponse.json({error:'Não foi possível registrar sua resposta.'},{status:500})}
}
