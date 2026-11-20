import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, photos: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const uploaderName = formData.get('uploader_name') as string | null
  const uploaderEmail = formData.get('uploader_email') as string | null
  const caption = formData.get('caption') as string | null

  if (!file || !uploaderName || !uploaderEmail) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: file, uploader_name, uploader_email' },
      { status: 400 },
    )
  }

  const supabase = getSupabase()

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Build a unique filename
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${params.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(filename)
  const photoUrl = urlData.publicUrl

  const { data, error: insertError } = await supabase
    .from('event_photos')
    .insert({
      event_id: params.id,
      url: photoUrl,
      caption: caption ?? null,
      uploader_name: uploaderName,
      uploader_email: uploaderEmail,
      likes_count: 0,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, photo: data }, { status: 201 })
}
