import { NextResponse }     from 'next/server'
import { supabaseAdmin }    from '@/lib/supabase/admin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies }          from 'next/headers'

export async function POST() {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const exists = buckets?.some(b => b.id === 'company-assets')

    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket('company-assets', {
        public: true,
        fileSizeLimit: 2097152,
        allowedMimeTypes: ['image/jpeg','image/png','image/webp','image/gif'],
      })
      if (error) {
        console.error('[ensure-bucket]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, created: !exists })
  } catch (err) {
    console.error('[ensure-bucket] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
