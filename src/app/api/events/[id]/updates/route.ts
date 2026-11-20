/**
 * Event Updates / Announcements API
 * GET:  List updates for an event (public, newest first)
 * POST: Create an update (auth required, publisher/admin only)
 *       Body: { title, message, notify_attendees: boolean }
 *       If notify_attendees is true, emails all confirmed RSVPs (fire-and-forget).
 *
 * Table: event_updates (id, event_id, author_id, title, message, notify_attendees, created_at)
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

/** GET — public list of updates for an event, newest first */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params
  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify event exists
  const { data: event } = await service
    .from('events')
    .select('id')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single()
  if (!event) return bad('Event not found', 404)

  const { data: updates, error } = await service
    .from('event_updates')
    .select('id, title, message, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.warn('[event-updates] GET error', error.message)
    return bad('Failed to fetch updates', 500)
  }

  return NextResponse.json({ ok: true, updates: updates || [] })
}

/** POST — create an update (publisher or admin only) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const { title, message, notify_attendees } = body
  if (!title?.trim()) return bad('Title is required')
  if (!message?.trim()) return bad('Message is required')

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

  // Authorization check
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    const { data: teamMember } = await service
      .from('event_team_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (prof?.role !== 'admin' && !teamMember) return bad('Not authorized', 403)
  }

  // Insert update
  const { data: update, error: insertError } = await service
    .from('event_updates')
    .insert({
      event_id: eventId,
      author_id: user.id,
      title: title.trim().substring(0, 200),
      message: message.trim().substring(0, 5000),
      notify_attendees: !!notify_attendees,
    })
    .select('id, title, message, created_at')
    .single()

  if (insertError) {
    console.warn('[event-updates] insert error', insertError.message)
    return bad('Failed to create update', 500)
  }

  // Fire-and-forget email notification to all confirmed RSVPs
  if (notify_attendees) {
    ;(async () => {
      try {
        const { data: rsvps } = await service
          .from('event_rsvps')
          .select('attendee_email, attendee_name')
          .eq('event_id', eventId)
          .in('status', ['confirmed', 'attended', 'pending'])

        if (!rsvps?.length) return

        // Deduplicate by email
        const seen = new Set<string>()
        const unique = rsvps.filter(r => {
          const e = r.attendee_email?.toLowerCase()
          if (!e || seen.has(e)) return false
          seen.add(e)
          return true
        })

        const emailHtml = renderEmail(`Update: ${title.trim()}`, `
          <p style="font-size:16px;font-weight:600;color:#4F46E5;margin-bottom:8px;">${escapeHtml(event.title)}</p>
          <p style="font-size:14px;font-weight:600;color:#334155;margin-bottom:4px;">${escapeHtml(title.trim())}</p>
          <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message.trim())}</div>
          <p style="font-size:12px;color:#94A3B8;margin-top:20px;border-top:1px solid #E2E8F0;padding-top:12px;">
            This is an event update from the organizer of "${escapeHtml(event.title)}".
            If you believe you received this in error, please contact the event organizer.
          </p>
        `)

        await Promise.allSettled(
          unique.map(r =>
            sendEmail({
              to: r.attendee_email,
              subject: `Event Update: ${title.trim()} — ${event.title}`,
              html: emailHtml,
            })
          )
        )

        console.log(`[event-updates] Notified ${unique.length} attendees for event ${eventId}`)
      } catch (err: any) {
        console.warn('[event-updates] notification error', err?.message)
      }
    })()
  }

  return NextResponse.json({ ok: true, update })
}
