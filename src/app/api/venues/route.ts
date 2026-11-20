/**
 * GET  /api/venues — list venues (optionally filtered by created_by)
 * POST /api/venues — create a new venue
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function GET() {
  const authSupabase = createServerSupabaseClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user) return bad('Unauthorized', 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .or(`is_private.eq.false,created_by.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true, venues: data })
}

export async function POST(request: Request) {
  const authSupabase = createServerSupabaseClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user) return bad('Unauthorized', 401)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const name = (body.name || '').toString().trim()
  if (!name) return bad('Name is required')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.from('venues').insert({
    name,
    address: (body.address || '').toString().trim(),
    city: (body.city || '').toString().trim(),
    state: (body.state || '').toString().trim(),
    zip_code: (body.zip_code || '').toString().trim(),
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    created_by: user.id,
    is_private: body.is_private ?? false,
  }).select('*').single()

  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true, venue: data }, { status: 201 })
}
