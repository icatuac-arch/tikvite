/**
 * Waitlist auto-promotion endpoint.
 * POST: Promotes the oldest waitlist entry for a tier, sends notification email
 * with a time-limited claim link (24 hours).
 *
 * Called on cancellation or by the cleanup cron.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { sendEmail, renderEmail } from '@/lib/email'

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

  const { event_id, tier_id } = body
  if (!event_id) return bad('Missing event_id')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Find oldest waitlist entry for this event (optionally filtered by tier)
  let query = service
    .from('event_rsvps')
    .select('*')
    .eq('event_id', event_id)
    .eq('status', 'waitlist')
    .order('created_at', { ascending: true })
    .limit(1)

  if (tier_id) {
    query = query.eq('tier_id', tier_id)
  }

  const { data: waitlistEntries } = await query
  if (!waitlistEntries?.length) {
    return NextResponse.json({ ok: true, promoted: false, message: 'No waitlist entries' })
  }

  const entry = waitlistEntries[0]

  // Generate a claim token with 24-hour expiry
  const claimToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Update RSVP with claim token
  const { error } = await service
    .from('event_rsvps')
    .update({
      status: 'pending',
      waitlist_promoted_at: new Date().toISOString(),
      waitlist_claim_token: claimToken,
      waitlist_claim_expires_at: expiresAt,
    })
    .eq('id', entry.id)

  if (error) return bad(error.message, 500)

  // Fetch event details for the email
  const { data: event } = await service
    .from('events')
    .select('title, date, venue')
    .eq('id', event_id)
    .single()

  const eventTitle = event?.title || 'Event'
  const claimUrl = `${SITE_URL}/waitlist/claim?token=${claimToken}`

  // Send notification email
  let emailSent = false
  try {
    const html = renderEmail('A Spot Has Opened Up!', `
      <p style="font-size:16px;font-weight:600;color:#4F46E5;margin-bottom:4px;">${eventTitle}</p>
      <p style="font-size:14px;color:#475569;margin:0 0 16px;">${event?.date || ''} at ${event?.venue || ''}</p>
      <p style="font-size:14px;color:#334155;">
        Great news, ${entry.attendee_name}! A spot has opened up and you have been promoted from the waitlist.
      </p>
      <p style="font-size:14px;color:#334155;margin-top:12px;">
        <strong>You have 24 hours to claim your spot.</strong> Click the button below to confirm your attendance.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${claimUrl}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
          Claim Your Spot
        </a>
      </div>
      <p style="font-size:12px;color:#94A3B8;margin-top:16px;">
        If you do not claim within 24 hours, the spot will be offered to the next person on the waitlist.
      </p>
    `)
    await sendEmail({
      to: entry.attendee_email,
      subject: `Spot available — ${eventTitle}`,
      html,
    })
    emailSent = true
  } catch (e: any) {
    console.warn('[waitlist] email send error:', e?.message)
  }

  return NextResponse.json({
    ok: true,
    promoted: true,
    rsvp_id: entry.id,
    attendee_email: entry.attendee_email,
    claim_expires_at: expiresAt,
    email_sent: emailSent,
    ...(!emailSent ? { warning: 'Promotion succeeded but notification email failed to send' } : {}),
  })
}
