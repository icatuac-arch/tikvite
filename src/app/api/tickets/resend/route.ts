import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail, renderTicketEmail } from '@/lib/email'
import { buildTicketQrUrl, generateQrDataUrl } from '@/lib/tickets'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { rsvp_id, ticket_number } = body

  if (!rsvp_id && !ticket_number) {
    return NextResponse.json({ ok: false, message: 'Provide rsvp_id or ticket_number' }, { status: 400 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Resolve RSVP
  let rsvpId = rsvp_id
  if (!rsvpId && ticket_number) {
    const { data: ticket } = await service
      .from('tickets')
      .select('rsvp_id')
      .eq('ticket_number', ticket_number)
      .single()
    if (!ticket) {
      return NextResponse.json({ ok: false, message: 'Ticket not found' }, { status: 404 })
    }
    rsvpId = ticket.rsvp_id
  }

  // Fetch RSVP
  const { data: rsvp } = await service
    .from('event_rsvps')
    .select('*, event_id')
    .eq('id', rsvpId)
    .single()
  if (!rsvp) {
    return NextResponse.json({ ok: false, message: 'RSVP not found' }, { status: 404 })
  }

  // Fetch event for ownership check
  const { data: event } = await service
    .from('events')
    .select('id, publisher_id, title, date, venue')
    .eq('id', rsvp.event_id)
    .single()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }

  // Authorization: publisher owns event or admin
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 })
    }
  }

  // Fetch active tickets for this RSVP
  const { data: tickets } = await service
    .from('tickets')
    .select('*')
    .eq('rsvp_id', rsvpId)
    .in('status', ['active', 'used'])

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ ok: false, message: 'No active tickets found for this RSVP' }, { status: 404 })
  }

  // Generate QR codes and send email
  try {
    const ticketEmailData = await Promise.all(
      tickets.map(async (t: any) => ({
        ticketNumber: t.ticket_number,
        qrDataUrl: await generateQrDataUrl(buildTicketQrUrl(t.qr_token)),
      }))
    )

    const html = renderTicketEmail({
      eventTitle: event.title,
      eventDate: event.date || '',
      eventVenue: event.venue || '',
      tickets: ticketEmailData,
    })

    await sendEmail({
      to: rsvp.attendee_email,
      subject: `Your Tickets — ${event.title}`,
      html,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: `Email send failed: ${e?.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticketCount: tickets.length })
}
