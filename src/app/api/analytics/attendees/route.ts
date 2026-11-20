/**
 * GET /api/analytics/attendees — Attendee CRM: aggregated attendee data across all events.
 * Requires auth (publisher or admin).
 * Groups by attendee_email, returns loyalty metrics.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function GET() {
  // Auth
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Check role
  const { data: profile } = await service.from('profiles').select('role, name').eq('id', user.id).single()
  if (!profile) return bad('Profile not found', 404)
  const isAdmin = profile.role === 'admin'

  // Get all events for this publisher (or all for admin)
  let eventsQuery = service
    .from('events')
    .select('id, title, date')
    .is('deleted_at', null)
    .order('date', { ascending: false })

  if (!isAdmin) {
    eventsQuery = eventsQuery.eq('publisher_id', user.id)
  }

  const { data: events } = await eventsQuery
  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, attendees: [], summary: { total_unique: 0, repeat_attendees: 0, avg_events: 0 } })
  }

  const eventIds = events.map(e => e.id)
  const eventMap: Record<string, { title: string; date: string }> = {}
  for (const e of events) {
    eventMap[e.id] = { title: e.title, date: e.date }
  }

  // Fetch all RSVPs for these events
  const { data: rsvps } = await service
    .from('event_rsvps')
    .select('id, event_id, attendee_name, attendee_email, status, created_at, tier_id, quantity')
    .in('event_id', eventIds)
    .in('status', ['confirmed', 'attended', 'pending'])

  if (!rsvps || rsvps.length === 0) {
    return NextResponse.json({ ok: true, attendees: [], summary: { total_unique: 0, repeat_attendees: 0, avg_events: 0 } })
  }

  // Aggregate by email
  const attendeeMap: Record<string, {
    email: string
    name: string
    events: { event_id: string; title: string; date: string; tickets: number; spent: number; status: string }[]
    total_tickets: number
    total_spent: number
    first_event_date: string
    last_event_date: string
  }> = {}

  for (const r of rsvps) {
    const email = (r.attendee_email || '').toLowerCase().trim()
    if (!email) continue

    const eventInfo = eventMap[r.event_id]
    if (!eventInfo) continue

    if (!attendeeMap[email]) {
      attendeeMap[email] = {
        email,
        name: r.attendee_name || '',
        events: [],
        total_tickets: 0,
        total_spent: 0,
        first_event_date: eventInfo.date,
        last_event_date: eventInfo.date,
      }
    }

    const att = attendeeMap[email]
    if (!att.name && r.attendee_name) att.name = r.attendee_name
    const tickets = r.quantity || 1
    const spent = 0 // Revenue tracked via orders, not RSVPs

    att.events.push({
      event_id: r.event_id,
      title: eventInfo.title,
      date: eventInfo.date,
      tickets,
      spent,
      status: r.status,
    })

    att.total_tickets += tickets
    att.total_spent += spent
    if (eventInfo.date < att.first_event_date) att.first_event_date = eventInfo.date
    if (eventInfo.date > att.last_event_date) att.last_event_date = eventInfo.date
  }

  // Deduplicate events per attendee (same event_id counts once)
  const attendees = Object.values(attendeeMap).map(a => {
    const uniqueEvents = new Map<string, typeof a.events[0]>()
    for (const ev of a.events) {
      if (!uniqueEvents.has(ev.event_id)) uniqueEvents.set(ev.event_id, ev)
      else {
        const existing = uniqueEvents.get(ev.event_id)!
        existing.tickets += ev.tickets
        existing.spent += ev.spent
      }
    }
    const eventsList = Array.from(uniqueEvents.values()).sort((x, y) => y.date.localeCompare(x.date))
    return {
      email: a.email,
      name: a.name,
      total_events_attended: eventsList.length,
      total_tickets: a.total_tickets,
      total_spent: a.total_spent,
      first_event_date: a.first_event_date,
      last_event_date: a.last_event_date,
      events: eventsList,
    }
  })

  // Sort by loyalty (most events attended)
  attendees.sort((a, b) => b.total_events_attended - a.total_events_attended || b.total_tickets - a.total_tickets)

  const total_unique = attendees.length
  const repeat_attendees = attendees.filter(a => a.total_events_attended >= 2).length
  const avg_events = total_unique > 0 ? Math.round((attendees.reduce((s, a) => s + a.total_events_attended, 0) / total_unique) * 10) / 10 : 0

  return NextResponse.json({
    ok: true,
    attendees,
    summary: { total_unique, repeat_attendees, avg_events },
  })
}
