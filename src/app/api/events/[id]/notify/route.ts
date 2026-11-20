/**
 * Organizer-to-attendee email notifications.
 * POST: Send email to ticket holders (all, checked_in, not_checked_in, tier-specific).
 * Rate limited: max 1 notification per event per hour.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { sendEmail, renderEmail, escapeHtml } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const { subject, message, segment } = body
  if (!subject?.trim() || !message?.trim()) return bad('Subject and message are required')

  // Auth: publisher or admin
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: event } = await service
    .from('events')
    .select('id, publisher_id, title')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single()
  if (!event) return bad('Event not found', 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return bad('Not authorized', 403)
  }

  // Rate limit: max 1 notification per event per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentNotifs } = await service
    .from('event_notifications')
    .select('id')
    .eq('event_id', eventId)
    .gte('sent_at', oneHourAgo)
    .limit(1)

  if (recentNotifs?.length) {
    return bad('You can only send one notification per event per hour. Please wait before sending another.', 429)
  }

  // Build recipient list based on segment
  let rsvpQuery = service
    .from('event_rsvps')
    .select('attendee_email, attendee_name, status, tier_id, checked_in_at')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'attended', 'pending'])

  const { data: rsvps } = await rsvpQuery
  if (!rsvps?.length) return bad('No recipients found for this segment')

  let recipients = rsvps
  const seg = (segment || 'all').toString()

  if (seg === 'checked_in') {
    recipients = rsvps.filter(r => r.checked_in_at || r.status === 'attended')
  } else if (seg === 'not_checked_in') {
    recipients = rsvps.filter(r => !r.checked_in_at && r.status !== 'attended')
  } else if (seg.startsWith('tier:')) {
    const tierId = seg.replace('tier:', '')
    recipients = rsvps.filter(r => r.tier_id === tierId)
  }

  if (!recipients.length) return bad('No recipients match the selected segment')

  // Deduplicate by email
  const emailSet = new Set<string>()
  const uniqueRecipients = recipients.filter(r => {
    const e = r.attendee_email.toLowerCase()
    if (emailSet.has(e)) return false
    emailSet.add(e)
    return true
  })

  // Send emails (fire-and-forget batch)
  const emailHtml = renderEmail(subject, `
    <p style="font-size:16px;font-weight:600;color:#4F46E5;margin-bottom:8px;">${escapeHtml(event.title)}</p>
    <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <p style="font-size:12px;color:#94A3B8;margin-top:20px;border-top:1px solid #E2E8F0;padding-top:12px;">
      This message was sent by the event organizer. If you believe you received this in error, please contact us.<br/>
      To stop receiving notifications for this event, please reply to this email or contact the event organizer.
    </p>
  `)

  let sentCount = 0
  const sendPromises = uniqueRecipients.map(async (r) => {
    try {
      await sendEmail({
        to: r.attendee_email,
        subject: `${subject} — ${event.title}`,
        html: emailHtml,
      })
      sentCount++
    } catch (e: any) {
      console.warn('[notify] email error for', r.attendee_email, e?.message)
    }
  })

  // Wait for all emails (with a reasonable timeout)
  await Promise.allSettled(sendPromises)

  // Log notification
  await service.from('event_notifications').insert({
    event_id: eventId,
    sender_id: user.id,
    subject: subject.substring(0, 500),
    message: message.substring(0, 10000),
    segment: seg,
    recipient_count: uniqueRecipients.length,
  })

  return NextResponse.json({
    ok: true,
    sent_count: uniqueRecipients.length,
    message: `Notification sent to ${uniqueRecipients.length} recipients`,
  })
}

/** GET: notification history for an event */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params

  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: event } = await service
    .from('events')
    .select('id, publisher_id')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single()
  if (!event) return bad('Event not found', 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return bad('Not authorized', 403)
  }

  const { data: notifications } = await service
    .from('event_notifications')
    .select('*')
    .eq('event_id', eventId)
    .order('sent_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ok: true, notifications: notifications || [] })
}
