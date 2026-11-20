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
    .from('event_interest')
    .select('user_name, avatar_url, signal')
    .eq('event_id', params.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const going = rows.filter((r) => r.signal === 'going').length
  const interested = rows.filter((r) => r.signal === 'interested').length
  const maybe = rows.filter((r) => r.signal === 'maybe').length

  const attendees = rows.map((r) => ({
    name: r.user_name,
    avatar_url: r.avatar_url ?? null,
    signal: r.signal,
  }))

  return NextResponse.json({ ok: true, going, interested, maybe, attendees })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: {
    user_email?: string
    user_name?: string
    signal?: 'interested' | 'going' | 'maybe'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_email, user_name, signal } = body

  if (!user_email || !user_name || !signal) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: user_email, user_name, signal' },
      { status: 400 },
    )
  }

  if (!['interested', 'going', 'maybe'].includes(signal)) {
    return NextResponse.json(
      { ok: false, error: 'signal must be one of: interested, going, maybe' },
      { status: 400 },
    )
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('event_interest')
    .upsert(
      {
        event_id: params.id,
        user_email,
        user_name,
        signal,
      },
      { onConflict: 'event_id,user_email' },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, interest: data })
}
