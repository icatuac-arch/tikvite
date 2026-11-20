import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } },
) {
  let body: { liker_email?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { liker_email } = body
  if (!liker_email) {
    return NextResponse.json({ ok: false, error: 'Missing liker_email' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Upsert into comment_likes — prevents double-liking
  const { error: upsertError } = await supabase
    .from('comment_likes')
    .upsert(
      { comment_id: params.commentId, liker_email },
      { onConflict: 'comment_id,liker_email' },
    )

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 })
  }

  // Re-count likes for accuracy
  const { count, error: countError } = await supabase
    .from('comment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', params.commentId)

  if (countError) {
    return NextResponse.json({ ok: false, error: countError.message }, { status: 500 })
  }

  // Update denormalized counter
  const { error: updateError } = await supabase
    .from('event_comments')
    .update({ likes_count: count ?? 0 })
    .eq('id', params.commentId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, likes_count: count ?? 0 })
}
