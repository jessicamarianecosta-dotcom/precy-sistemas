import { NextResponse } from 'next/server'
import { randomUUID,createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
const hash=(token:string)=>createHash('sha256').update(token).digest('hex')
export async function POST(req:Request,ctx:{params:Promise<{token:string}>}) {
 try {
  const {token}=await ctx.params
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({error:'Link inválido.'},{status:404})
  const db=supabaseAdmin as any
  const {data:link}=await db.from('order_art_approval_links').select('id,company_id,order_id,order_item_id,status,revoked_at').eq('token_hash',hash(token)).maybeSingle()
  if(!link||link.revoked_at||link.status!=='aguardando_aprovacao') return NextResponse.json({error:'Link encerrado.'},{status:404})
  const form=await req.formData(); const files=form.getAll('files').filter((v):v is File=>v instanceof File)
  if(!files.length||files.length>5) return NextResponse.json({error:'Anexe de 1 a 5 arquivos.'},{status:400})
  const paths:string[]=[]
  for(const file of files) {
   if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp','application/pdf'].includes(file.type)) return NextResponse.json({error:'Cada anexo deve ser PDF, PNG, JPG ou WEBP de até 5 MB.'},{status:400})
   const path=`${link.company_id}/${link.order_id}/${link.order_item_id}/customer/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
   const {error}=await supabaseAdmin.storage.from('art-approvals').upload(path,file,{contentType:file.type,upsert:false})
   if(error) throw error
   paths.push(path)
  }
  return NextResponse.json({paths})
 } catch(e) { console.error('[art approval attachments]',e); return NextResponse.json({error:'Falha ao enviar anexos.'},{status:500}) }
}
