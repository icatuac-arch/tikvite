/**
 * Ticket Transfer API — POST /api/tickets/transfer
 * Body: { ticket_number, new_holder_name, new_holder_email }
 * Transfers a ticket to a new holder, invalidates old QR, generates new one.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateQrToken, buildTicketQrUrl, generateQrDataUrl } from '@/lib/tickets'
import { sendEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return json({ ok: false, error: 'Invalid JSON' }, 400) }

  const ticketNumber = (body.ticket_number || '').toString().trim()
  const holderEmail = (body.holder_email || '').toString().trim()
  const newHolderName = (body.new_holder_name || '').toString().trim()
  const newHolderEmail = (body.new_holder_email || '').toString().trim()

  if (!ticketNumber || !holderEmail || !newHolderName || !newHolderEmail) {
    return json({ ok: false, error: 'Missing required fields: ticket_number, holder_email, new_holder_name, new_holder_email' }, 400)
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newHolderEmail)) {
    return json({ ok: false, error: 'Invalid email address' }, 400)
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch ticket
  const { data: ticket, error: ticketErr } = await service
    .from('tickets')
    .select('id, event_id, status, holder_name, holder_email, ticket_number, events(title, date, venue)')
    .eq('ticket_number', ticketNumber)
    .single()

  if (ticketErr || !ticket) {
    return json({ ok: false, error: 'Ticket not found' }, 404)
  }

  // Verify ownership: the requester must prove they are the current holder
  if (ticket.holder_email.toLowerCase() !== holderEmail.toLowerCase()) {
    return json({ ok: false, error: 'Holder email does not match the current ticket holder' }, 403)
  }

  // Only active tickets can be transferred
  if (ticket.status !== 'active') {
    return json({ ok: false, error: `Cannot transfer ticket with status "${ticket.status}". Only active tickets can be transferred.` }, 400)
  }

  // Generate new QR token (old one is invalidated)
  const newQrToken = generateQrToken()
  const now = new Date().toISOString()

  const { error: updateErr } = await service
    .from('tickets')
    .update({
      holder_name: newHolderName,
      holder_email: newHolderEmail,
      qr_token: newQrToken,
      transferred_from_name: ticket.holder_name,
      transferred_from_email: ticket.holder_email,
      transferred_at: now,
      updated_at: now,
    })
    .eq('id', ticket.id)

  if (updateErr) {
    return json({ ok: false, error: updateErr.message }, 500)
  }

  // Send email to new holder (fire and forget)
  const event = (ticket as any).events
  ;(async () => {
    try {
      const qrUrl = buildTicketQrUrl(newQrToken)
      const qrDataUrl = await generateQrDataUrl(qrUrl)
      const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Ticket Transferred to You</h2>
          <p>${ticket.holder_name} has transferred a ticket to you for <strong>${event?.title || 'an event'}</strong>.</p>
          ${event?.date ? `<p><strong>Date:</strong> ${event.date}</p>` : ''}
          ${event?.venue ? `<p><strong>Venue:</strong> ${event.venue}</p>` : ''}
          <p><strong>Ticket #:</strong> ${ticket.ticket_number}</p>
          <div style="text-align: center; margin: 24px 0;">
            <img src="${qrDataUrl}" alt="QR Code" width="220" height="220" style="border-radius: 8px;" />
          </div>
          <p style="text-align: center;"><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'}/ticket/${encodeURIComponent(ticket.ticket_number)}" style="color: #4F46E5;">View Your Ticket</a></p>
          <p style="color: #999; font-size: 12px;">Ticvite.com</p>
        </div>
      `
      await sendEmail({
        to: newHolderEmail,
        subject: `Ticket Transfer — ${event?.title || 'Event'}`,
        html,
      })
    } catch (e: any) {
      console.warn('[email] transfer email error:', e?.message)
    }
  })()

  return json({
    ok: true,
    ticket_number: ticket.ticket_number,
    new_holder_name: newHolderName,
    new_holder_email: newHolderEmail,
    transferred_from_name: ticket.holder_name,
    transferred_from_email: ticket.holder_email,
  })
}
