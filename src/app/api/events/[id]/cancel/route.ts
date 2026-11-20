import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail, escapeHtml, renderEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Not authenticated' }, { status: 401 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch event
  const { data: event } = await service.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }

  // Ownership check
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 })
    }
  }

  // 1. Set event status to rejected with cancellation feedback
  await service.from('events').update({
    status: 'rejected',
    rejection_feedback: 'Event cancelled by organizer',
  }).eq('id', id)

  // 2. Cancel all active tickets
  await service
    .from('tickets')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('event_id', id)
    .in('status', ['active'])

  // 3. Cancel all confirmed/pending RSVPs
  await service
    .from('event_rsvps')
    .update({ status: 'cancelled' })
    .eq('event_id', id)
    .in('status', ['confirmed', 'pending', 'waitlist'])

  // 4. Fetch all RSVPs that had tickets to notify
  const { data: rsvps } = await service
    .from('event_rsvps')
    .select('attendee_name, attendee_email')
    .eq('event_id', id)

  let notified = 0

  if (rsvps && rsvps.length > 0) {
    // Deduplicate by email
    const seen = new Set<string>()
    const unique = rsvps.filter((r: any) => {
      if (!r.attendee_email || seen.has(r.attendee_email)) return false
      seen.add(r.attendee_email)
      return true
    })

    const cancellationHtml = renderEmail('Event Cancelled', `
      <p style="font-size:15px;color:#334155;">Hi there,</p>
      <p style="font-size:15px;color:#334155;">We're sorry to inform you that <strong>${escapeHtml(event.title)}</strong> scheduled for <strong>${escapeHtml(event.date || 'TBD')}</strong> has been <span style="color:#C62828;font-weight:700;">cancelled</span> by the organizer.</p>
      <div style="margin:20px 0;padding:18px;background:#FEE2E2;border-radius:12px;border-left:4px solid #C62828;">
        <p style="font-size:14px;color:#C62828;margin:0;font-weight:600;">All tickets have been revoked and RSVPs have been cancelled.</p>
      </div>
      <p style="font-size:14px;color:#334155;">If you had a paid ticket, please contact the organizer regarding refunds.</p>
      <p style="font-size:14px;color:#475569;">We apologize for the inconvenience.</p>
    `)

    // Send emails (fire-and-forget, but count)
    for (const r of unique) {
      sendEmail({
        to: r.attendee_email,
        subject: `Event Cancelled: ${event.title}`,
        html: cancellationHtml,
      }).catch(() => {})
      notified++
    }
  }

  return NextResponse.json({ ok: true, notified })
}
