/**
 * GET /api/tickets/wallet?ticket_number=...&type=apple|google
 * Wallet pass generation — placeholder implementation.
 * Apple Wallet requires a signing certificate; Google Wallet requires a service account.
 * Both return a "coming soon" JSON response until certificates are provisioned.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ticketNumber = url.searchParams.get('ticket_number')
  const type = url.searchParams.get('type') || 'apple'

  if (!ticketNumber) {
    return NextResponse.json({ ok: false, error: 'Missing ticket_number' }, { status: 400 })
  }

  if (!['apple', 'google'].includes(type)) {
    return NextResponse.json({ ok: false, error: 'type must be "apple" or "google"' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify ticket exists
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, holder_name, holder_email, status, events(title, date, time, venue, city)')
    .eq('ticket_number', ticketNumber)
    .single()

  if (!ticket) {
    return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 })
  }

  if (ticket.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Ticket is not active' }, { status: 400 })
  }

  // Placeholder — return structured data about what the pass would contain
  const event = ticket.events as any

  if (type === 'apple') {
    return NextResponse.json({
      ok: false,
      coming_soon: true,
      type: 'apple',
      message: 'Apple Wallet passes require an Apple Developer certificate. This feature is coming soon.',
      pass_preview: {
        format: 'pkpass',
        organization: 'Ticvite',
        event_name: event?.title || 'Event',
        date: event?.date,
        time: event?.time,
        venue: event?.venue,
        holder: ticket.holder_name,
        ticket_number: ticket.ticket_number,
        barcode_type: 'PKBarcodeFormatQR',
      },
    })
  }

  // Google Wallet
  return NextResponse.json({
    ok: false,
    coming_soon: true,
    type: 'google',
    message: 'Google Wallet passes require a Google Cloud service account. This feature is coming soon.',
    pass_preview: {
      format: 'jwt',
      issuer: 'Ticvite',
      event_name: event?.title || 'Event',
      date: event?.date,
      time: event?.time,
      venue: event?.venue,
      holder: ticket.holder_name,
      ticket_number: ticket.ticket_number,
      barcode_type: 'QR_CODE',
    },
  })
}
