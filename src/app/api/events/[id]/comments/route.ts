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
    .from('event_comments')
    .select('*')
    .eq('event_id', params.id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Separate top-level and replies
  const topLevel = (data ?? []).filter((c) => !c.parent_id)
  const replies = (data ?? []).filter((c) => !!c.parent_id)

  // Attach replies to their parents
  const comments = topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parent_id === c.id),
  }))

  return NextResponse.json({ ok: true, comments })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: {
    event_id?: string
    parent_id?: string | null
    author_name?: string
    author_email?: string
    body?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_id, parent_id, author_name, author_email, body: commentBody } = body

  if (!event_id || !author_name || !author_email || !commentBody) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: event_id, author_name, author_email, body' },
      { status: 400 },
    )
  }

  if (event_id !== params.id) {
    return NextResponse.json({ ok: false, error: 'event_id mismatch' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('event_comments')
    .insert({
      event_id,
      parent_id: parent_id ?? null,
      author_name,
      author_email,
      body: commentBody,
      likes_count: 0,
      pinned: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, comment: data }, { status: 201 })
}
