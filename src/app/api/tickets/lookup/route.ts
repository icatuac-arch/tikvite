/**
 * Public ticket lookup API.
 * GET /api/tickets/lookup?q=<email or ticket_number>
 * Returns matching tickets with event info. No auth required.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return bad('Missing search query')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  const isEmail = q.includes('@')

  let tickets: any[] = []

  if (isEmail) {
    // Search by holder email
    const { data, error } = await service
      .from('tickets')
      .select('ticket_number, holder_name, holder_email, status, events(id, title, date, time, venue, city, state, allow_self_cancel)')
      .eq('holder_email', q.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return bad('Search failed')
    tickets = data || []
  } else {
    // Search by ticket number (exact or partial)
    const { data, error } = await service
      .from('tickets')
      .select('ticket_number, holder_name, holder_email, status, events(id, title, date, time, venue, city, state, allow_self_cancel)')
      .eq('ticket_number', q.toUpperCase())
      .limit(10)

    if (error) return bad('Search failed')
    tickets = data || []

    // Also check confirmation_code in event_rsvps if no tickets found
    if (tickets.length === 0) {
      const { data: rsvps } = await service
        .from('event_rsvps')
        .select('*, events(id, title, date, time, venue, city, state, allow_self_cancel)')
        .eq('confirmation_code', q.toUpperCase())
        .limit(10)

      if (rsvps && rsvps.length > 0) {
        // Look up tickets for these RSVPs by email
        for (const rsvp of rsvps) {
          const { data: rsvpTickets } = await service
            .from('tickets')
            .select('ticket_number, holder_name, holder_email, status, events(id, title, date, time, venue, city, state, allow_self_cancel)')
            .eq('holder_email', rsvp.email)
            .eq('event_id', rsvp.event_id)
            .limit(10)
          if (rsvpTickets) tickets.push(...rsvpTickets)
        }
      }
    }
  }

  // Flatten for the frontend
  const results = tickets.map((t: any) => {
    const ev = t.events as any
    return {
      ticket_number: t.ticket_number,
      holder_name: t.holder_name,
      holder_email: t.holder_email,
      status: t.status,
      event_title: ev?.title || 'Unknown Event',
      event_date: ev?.date || '',
      event_time: ev?.time || '',
      event_venue: ev?.venue || '',
      event_city: ev?.city || '',
      event_state: ev?.state || '',
      event_id: ev?.id || '',
      allow_self_cancel: !!ev?.allow_self_cancel,
    }
  })

  return NextResponse.json({ ok: true, tickets: results })
}
