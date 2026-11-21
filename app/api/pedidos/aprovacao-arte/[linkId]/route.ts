import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { ART_FINISHING_INSTRUCTIONS, ART_FINISHING_INSTRUCTIONS_VERSION, hasDigitalArtApprovalBeta, decryptApprovalToken } from '@/lib/orders/digitalArtApproval'

async function owner() {
 const auth=createServerComponentClient({cookies})
 const {data:{user}}=await auth.auth.getUser()
 if(!user||!hasDigitalArtApprovalBeta(user.email)) return {user:null,companyId:null}
 return {user,companyId:await resolveCompanyIdForUser(user.id)}
}
export async function GET(_req:Request,ctx:{params:Promise<{linkId:string}>}) {
 try {
  const {user,companyId}=await owner()
  if(!user||!companyId) return NextResponse.json({error:'Não autorizado.'},{status:401})
  const {linkId}=await ctx.params; const db=supabaseAdmin as any
  const {data:link,error}=await db.from('order_art_approval_links').select('id,status,current_version,created_at,deadline,public_notes,revoked_at,cancelled_at,token_ciphertext').eq('id',linkId).eq('company_id',companyId).maybeSingle()
  if(error) throw error
  if(!link) return NextResponse.json({error:'Link não encontrado.'},{status:404})
  const {data:versions,error:ve}=await db.from('order_art_approval_versions').select('id,version_number,status,created_at,instructions_version,public_notes').eq('link_id',linkId).order('version_number',{ascending:false})
  if(ve) throw ve
  const ids=(versions??[]).map((v:any)=>v.id)
  const {data:responses,error:re}=ids.length?await db.from('order_art_approval_responses').select('id,version_id,response,customer_name,customer_note,consented_at,created_at,attachment_paths').in('version_id',ids):{data:[],error:null}
  if(re) throw re
  const {data:notifications,error:ne}=await db.from('order_art_approval_notifications').select('id,title,message,notification_type,read_at,created_at').eq('link_id',linkId).order('created_at',{ascending:false})
  if(ne) throw ne
  return NextResponse.json({link:{...link,publicUrl:link.token_ciphertext?new URL(`/aprovar-arte/${decryptApprovalToken(link.token_ciphertext)}`,_req.url).toString():null},notifications:notifications??[],history:(versions??[]).map((v:any)=>({...v,response:(responses??[]).find((r:any)=>r.version_id===v.id)??null}))})
 } catch(e) { console.error('[art approval history]',e); return NextResponse.json({error:'Não foi possível carregar o histórico.'},{status:500}) }
}
export async function POST(req:Request,ctx:{params:Promise<{linkId:string}>}) {
 try {
  const {user,companyId}=await owner()
  if(!user||!companyId) return NextResponse.json({error:'Não autorizado.'},{status:401})
  const {linkId}=await ctx.params; const body=await req.json(); const db=supabaseAdmin as any
  const {data:link,error}=await db.from('order_art_approval_links').select('*').eq('id',linkId).eq('company_id',companyId).maybeSingle()
  if(error) throw error
  if(!link) return NextResponse.json({error:'Link não encontrado.'},{status:404})
  if(body.action==='cancel') {
   if(link.status==='aprovada') return NextResponse.json({error:'Uma arte aprovada não pode ser cancelada.'},{status:409})
   const {error:ue}=await db.from('order_art_approval_links').update({status:'cancelada',revoked_at:new Date().toISOString(),cancelled_at:new Date().toISOString(),cancelled_by:user.id,updated_at:new Date().toISOString()}).eq('id',linkId)
   if(ue) throw ue
   await db.from('order_art_events').insert({order_id:link.order_id,company_id:companyId,created_by:user.id,event_type:'aprovacao_digital_cancelada',description:'Link de aprovação digital cancelado pela equipe.'})
   return NextResponse.json({ok:true,status:'cancelada'})
  }
  if(body.action==='new_version') {
   if(link.status==='aprovada'||link.status==='cancelada') return NextResponse.json({error:'Não é possível criar versão para este link encerrado.'},{status:409})
   const fileIds=Array.isArray(body.fileIds)?body.fileIds.filter((x:unknown)=>typeof x==='string'):[]
   if(!fileIds.length||fileIds.length>20) return NextResponse.json({error:'Selecione de 1 a 20 arquivos.'},{status:400})
   const {data:files,error:fe}=await db.from('order_files').select('id,file_name,file_path,mime_type,file_size,file_role').in('id',fileIds).eq('order_id',link.order_id).eq('order_item_id',link.order_item_id)
   if(fe) throw fe
   if(!files||files.length!==fileIds.length) return NextResponse.json({error:'Há arquivo que não pertence a este item.'},{status:400})
   const allowedRoles=['cliente_arte','referencia','proposta','versao_final']; const allowedTypes=['image/png','image/jpeg','image/webp','application/pdf']
   if(files.some((f:any)=>!allowedRoles.includes(f.file_role)||!allowedTypes.includes(f.mime_type)||Number(f.file_size)>10*1024*1024)) return NextResponse.json({error:'Use arquivos PDF, PNG, JPG ou WEBP de até 10 MB.'},{status:400})
   const paths:string[]=[]
   for(const f of files) {
    const {data:blob,error:de}=await supabaseAdmin.storage.from('order-files').download(f.file_path)
    if(de||!blob) throw new Error('Falha ao copiar arquivo privado.')
    const path=`${companyId}/${link.order_id}/${link.order_item_id}/${randomUUID()}-${f.file_name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
    const {error:up}=await supabaseAdmin.storage.from('art-approvals').upload(path,blob,{contentType:f.mime_type||'application/octet-stream',upsert:false})
    if(up) throw up
    paths.push(path)
   }
   const next=Number(link.current_version)+1
   const {error:oldError}=await db.from('order_art_approval_versions').update({status:'substituida',superseded_at:new Date().toISOString()}).eq('link_id',linkId).eq('version_number',link.current_version)
   if(oldError) throw oldError
   const {error:ve}=await db.from('order_art_approval_versions').insert({link_id:linkId,version_number:next,file_ids:fileIds,private_file_paths:paths,instructions_version:ART_FINISHING_INSTRUCTIONS_VERSION,instructions_text:ART_FINISHING_INSTRUCTIONS,public_notes:String(body.publicNotes??'').trim().slice(0,2000)||null})
   if(ve) throw ve
   const {error:le}=await db.from('order_art_approval_links').update({current_version:next,status:'aguardando_aprovacao',public_notes:String(body.publicNotes??'').trim().slice(0,2000)||null,deadline:body.deadline?new Date(body.deadline).toISOString():link.deadline,revoked_at:null,updated_at:new Date().toISOString()}).eq('id',linkId)
   if(le) throw le
   await db.from('order_art_events').insert({order_id:link.order_id,company_id:companyId,created_by:user.id,event_type:'aprovacao_digital_nova_versao',description:`Nova versão ${next} enviada para aprovação digital.`})
   return NextResponse.json({ok:true,version:next})
  }
  return NextResponse.json({error:'Ação inválida.'},{status:400})
 } catch(e) { console.error('[art approval action]',e); return NextResponse.json({error:'Não foi possível executar a ação.'},{status:500}) }
}
