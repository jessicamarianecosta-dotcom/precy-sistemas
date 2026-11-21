import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { createApprovalToken, ART_FINISHING_INSTRUCTIONS, ART_FINISHING_INSTRUCTIONS_VERSION, hasDigitalArtApprovalBeta } from '@/lib/orders/digitalArtApproval'

export async function POST(request: Request) {
 try {
  const auth=createServerComponentClient({cookies}); const {data:{user}}=await auth.auth.getUser()
  if(!user) return NextResponse.json({error:'Não autenticado'},{status:401})
  if(!hasDigitalArtApprovalBeta(user.email)) return NextResponse.json({error:'Recurso indisponível.'},{status:404})
  const companyId=await resolveCompanyIdForUser(user.id); if(!companyId) return NextResponse.json({error:'Empresa não encontrada.'},{status:404})
  const body=await request.json(); const orderId=String(body.orderId??''); const itemId=String(body.itemId??'')
  const fileIds=Array.isArray(body.fileIds)?body.fileIds.filter((x:unknown)=>typeof x==='string'):[]
  if(!orderId||!itemId||!fileIds.length) return NextResponse.json({error:'Selecione arquivos para aprovação.'},{status:400})
  const db=supabaseAdmin as any
  const {data:order,error:oe}=await db.from('orders').select('id,order_number,customer_id,due_date').eq('id',orderId).eq('company_id',companyId).maybeSingle()
  if(oe) throw oe; if(!order) return NextResponse.json({error:'Pedido não encontrado.'},{status:404})
  const {data:item,error:ie}=await db.from('order_items').select('id,name,art_origin').eq('id',itemId).eq('order_id',orderId).maybeSingle()
  if(ie) throw ie; if(!item||!item.art_origin) return NextResponse.json({error:'Item sem arte vinculada.'},{status:400})
  const {data:files,error:fe}=await db.from('order_files').select('id,file_name,file_path,mime_type,file_size').in('id',fileIds).eq('order_id',orderId).eq('order_item_id',itemId)
  if(fe) throw fe; if(!files||files.length!==fileIds.length) return NextResponse.json({error:'Arquivo inválido para este item.'},{status:400})
  const privatePaths:string[]=[]
  for(const f of files){
   const {data:blob,error:de}=await supabaseAdmin.storage.from('order-files').download(f.file_path)
   if(de||!blob) throw new Error('Não foi possível preparar um arquivo privado para aprovação.')
   const path=`${companyId}/${orderId}/${itemId}/${randomUUID()}-${f.file_name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
   const {error:up}=await supabaseAdmin.storage.from('art-approvals').upload(path,blob,{contentType:f.mime_type||'application/octet-stream',upsert:false})
   if(up) throw up
   privatePaths.push(path)
  }
  const {token,tokenHash}=createApprovalToken()
  const deadline=body.deadline?new Date(body.deadline).toISOString():order.due_date
  const publicNotes=String(body.publicNotes??'').trim().slice(0,2000)||null
  const {data:link,error:le}=await db.from('order_art_approval_links').insert({company_id:companyId,order_id:orderId,order_item_id:itemId,token_hash:tokenHash,status:'aguardando_aprovacao',current_version:1,public_notes:publicNotes,deadline,created_by:user.id}).select('id').single()
  if(le) throw le
  const {error:ve}=await db.from('order_art_approval_versions').insert({link_id:link.id,version_number:1,file_ids:fileIds,private_file_paths:privatePaths,instructions_version:ART_FINISHING_INSTRUCTIONS_VERSION,instructions_text:ART_FINISHING_INSTRUCTIONS,public_notes:publicNotes})
  if(ve) throw ve
  await db.from('order_items').update({art_approval_status:'proposals_sent',updated_at:new Date().toISOString()}).eq('id',itemId)
  await db.from('order_art_events').insert({order_id:orderId,company_id:companyId,created_by:user.id,event_type:'aprovacao_digital_enviada',description:`Link público de aprovação digital criado para “${item.name}”, versão 1.`})
  return NextResponse.json({ok:true,url:`${new URL(request.url).origin}/aprovar-arte/${token}`,orderNumber:order.order_number,itemName:item.name})
 }catch(e){console.error('[aprovacao-arte:create]',e);return NextResponse.json({error:'Não foi possível gerar o link de aprovação.'},{status:500})}
}
