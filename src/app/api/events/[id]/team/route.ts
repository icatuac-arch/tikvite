/**
 * Event team management API.
 * GET  — list team members for this event
 * POST — add a team member (by email)
 * DELETE — remove a team member
 */
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

async function verifyOwnerOrAdmin(supabase: any, eventId: string, userId: string) {
  // Check if user owns the event
  const { data: event } = await supabase
    .from('events')
    .select('publisher_id')
    .eq('id', eventId)
    .single()
  if (!event) return false
  if (event.publisher_id === userId) return true

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'admin'
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return bad('Not authenticated', 401)

  const eventId = params.id
  if (!await verifyOwnerOrAdmin(supabase, eventId, user.id)) {
    return bad('Not authorized', 403)
  }

  const { data: members, error } = await supabase
    .from('event_team_members')
    .select('id, user_email, user_id, role, accepted, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) return bad(error.message, 500)

  return NextResponse.json({ ok: true, members: members || [] })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return bad('Not authenticated', 401)

  const eventId = params.id
  if (!await verifyOwnerOrAdmin(supabase, eventId, user.id)) {
    return bad('Not authorized', 403)
  }

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const email = (body.email || '').toString().trim().toLowerCase()
  const role = (body.role || 'checkin').toString().trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad('Please provide a valid email address')
  }
  if (!['organizer', 'checkin', 'viewer'].includes(role)) {
    return bad('Invalid role. Choose: organizer, checkin, or viewer')
  }

  // Check if already a team member
  const { data: existing } = await supabase
    .from('event_team_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_email', email)
    .maybeSingle()

  if (existing) return bad('This person is already on the team')

  // Check if this email belongs to a registered user
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const { data: member, error } = await supabase
    .from('event_team_members')
    .insert({
      event_id: eventId,
      user_email: email,
      user_id: profile?.id || null,
      role,
      invited_by: user.id,
      accepted: !!profile?.id, // auto-accept if registered user
    })
    .select('id, user_email, user_id, role, accepted, created_at')
    .single()

  if (error) return bad(error.message, 500)

  return NextResponse.json({ ok: true, member })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return bad('Not authenticated', 401)

  const eventId = params.id
  if (!await verifyOwnerOrAdmin(supabase, eventId, user.id)) {
    return bad('Not authorized', 403)
  }

  const url = new URL(request.url)
  const memberId = url.searchParams.get('member_id')
  if (!memberId) return bad('Missing member_id')

  const { error } = await supabase
    .from('event_team_members')
    .delete()
    .eq('id', memberId)
    .eq('event_id', eventId)

  if (error) return bad(error.message, 500)

  return NextResponse.json({ ok: true })
}
