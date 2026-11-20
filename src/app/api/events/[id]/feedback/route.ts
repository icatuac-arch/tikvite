import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/events/[id]/feedback — List feedback (auth required, publisher/admin)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Not authenticated' }, { status: 401 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify ownership or admin
  const { data: event } = await service.from('events').select('publisher_id').eq('id', id).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 })
    }
  }

  const { data: feedback, error } = await service
    .from('event_feedback')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, feedback })
}

/**
 * POST /api/events/[id]/feedback — Submit feedback (public)
 * Body: { email, name, rating: 1-5, comment }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { email, name, rating, comment } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ ok: false, message: 'Valid email is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ ok: false, message: 'Name is required' }, { status: 400 })
  }
  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, message: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify event exists
  const { data: event } = await service.from('events').select('id').eq('id', id).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }

  const { data: inserted, error } = await service
    .from('event_feedback')
    .insert({
      event_id: id,
      attendee_email: email.trim().toLowerCase(),
      attendee_name: name.trim(),
      rating: Math.round(rating),
      comment: (comment || '').trim(),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: 'You have already submitted feedback for this event' },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}
