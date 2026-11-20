/**
 * Self-service ticket cancellation API.
 * POST: { ticket_number, holder_email }
 * Verifies email matches, cancels ticket + RSVP, sends email, promotes waitlist.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, renderEmail, escapeHtml } from '@/lib/email'
import { resolveTemplate } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const { ticket_number, holder_email } = body
  if (!ticket_number || !holder_email) return bad('Missing ticket_number or holder_email')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch ticket with event info
  const { data: ticket, error: ticketErr } = await service
    .from('tickets')
    .select('*, events(id, title, date, time, venue, city, state, allow_self_cancel, email_templates)')
    .eq('ticket_number', ticket_number)
    .single()

  if (ticketErr || !ticket) return bad('Ticket not found', 404)

  // Verify email matches
  if (ticket.holder_email?.toLowerCase() !== holder_email.toLowerCase()) {
    return bad('Email does not match the ticket holder', 403)
  }

  // Check ticket is cancellable
  if (ticket.status === 'cancelled') return bad('Ticket is already cancelled')
  if (ticket.status === 'used') return bad('Cannot cancel a ticket that has been checked in')
  if (ticket.status !== 'active') return bad('Ticket cannot be cancelled in its current state')

  const event = ticket.events as any

  // Check if self-cancel is allowed for this event
  if (!event?.allow_self_cancel) {
    return NextResponse.json({ ok: false, error: 'Self-service cancellation is not enabled for this event' }, { status: 403 })
  }

  // Cancel the ticket
  const { error: updateErr } = await service
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('id', ticket.id)

  if (updateErr) return bad('Failed to cancel ticket')

  // Cancel associated RSVP(s)
  await service
    .from('event_rsvps')
    .update({ status: 'cancelled' })
    .eq('event_id', ticket.event_id)
    .eq('email', holder_email.toLowerCase())
    .in('status', ['confirmed', 'pending'])

  // Send cancellation email with custom template support
  const cancelTemplateVars = {
    event_title: event?.title || 'Event',
    event_date: event?.date || '',
    event_time: event?.time || '',
    venue: event?.venue || '',
    city: event?.city || '',
    attendee_name: (ticket.holder_name || '').split(' ')[0] || 'there',
    ticket_number: ticket_number,
    ticket_url: `${SITE_URL}/ticket/${encodeURIComponent(ticket_number)}`,
  }
  const cancelSubject = resolveTemplate(event?.email_templates, 'cancellation_subject', cancelTemplateVars)
  const emailHtml = renderEmail('Booking Cancelled', `
    <p style="font-size:15px;color:#334155;">Hi ${escapeHtml((ticket.holder_name || '').split(' ')[0] || 'there')},</p>
    <p style="font-size:15px;color:#334155;">Your booking has been <strong>cancelled</strong> for the following event:</p>
    <div style="margin:20px 0;padding:18px;background:#F1F5F9;border-radius:12px;border-left:4px solid #C62828;">
      <p style="font-size:16px;font-weight:600;color:#4F46E5;margin:0 0 6px;">${escapeHtml(event?.title || 'Event')}</p>
      ${event?.date ? `<p style="font-size:14px;color:#475569;margin:0 0 2px;">${escapeHtml(event.date)}${event.time ? ` at ${escapeHtml(event.time)}` : ''}</p>` : ''}
      ${event?.venue ? `<p style="font-size:14px;color:#475569;margin:0;">${escapeHtml(event.venue)}</p>` : ''}
    </div>
    <p style="font-size:14px;color:#475569;">Ticket: <strong style="font-family:ui-monospace,monospace;">${escapeHtml(ticket_number)}</strong></p>
    <p style="font-size:14px;color:#334155;">If you cancelled by mistake, please contact the event organizer.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Browse More Events</a>
    </div>
  `)

  sendEmail({
    to: holder_email,
    subject: cancelSubject,
    html: emailHtml,
  }).catch(() => { /* fire and forget */ })

  // Promote waitlist if applicable
  try {
    await fetch(`${SITE_URL}/api/waitlist/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: ticket.event_id,
        tier_id: ticket.tier_id,
      }),
    })
  } catch {
    // Non-critical — don't fail the cancellation
  }

  return NextResponse.json({ ok: true, message: 'Ticket cancelled successfully' })
}
