/**
 * Automated Event Reminder Cron Job
 *
 * Runs every 3 hours (configured in vercel.json).
 * Sends three types of reminder emails to ticket holders:
 *   1. 1-Day Reminder  — event is tomorrow (Pacific time)
 *   2. 3-Hour Reminder — event starts within 3-4 hours
 *   3. Post-Event Follow-up — event was yesterday
 *
 * Idempotent: each reminder type uses a `_sent` flag on the event row
 * to prevent duplicate sends. Safe to invoke externally.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendEmail,
  renderReminderEmail,
  renderStartingSoonEmail,
  renderFollowUpEmail,
} from '@/lib/email'
import { resolveTemplate } from '@/lib/email-templates'
import { getShortId } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ── Pacific-time helpers ─────────────────────────────────────────── */

function nowPacific(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
  )
}

/** Format a JS Date as YYYY-MM-DD in Pacific time. */
function pacificDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift a Pacific-time date by `days`. */
function shiftDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

/**
 * Parse the event's date + time into a Pacific-time timestamp.
 * `time` may be "7:00 PM", "19:00", or empty.
 */
function eventPacificTime(dateStr: string, timeStr?: string | null): Date | null {
  if (!dateStr) return null
  try {
    // dateStr is YYYY-MM-DD
    let hour = 0
    let minute = 0
    if (timeStr) {
      const cleaned = timeStr.trim().toUpperCase()
      const m12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
      if (m12) {
        hour = parseInt(m12[1], 10)
        minute = parseInt(m12[2], 10)
        if (m12[3] === 'PM' && hour !== 12) hour += 12
        if (m12[3] === 'AM' && hour === 12) hour = 0
      } else {
        const m24 = cleaned.match(/^(\d{1,2}):(\d{2})$/)
        if (m24) {
          hour = parseInt(m24[1], 10)
          minute = parseInt(m24[2], 10)
        }
      }
    }
    // Build a date string in Pacific
    const [y, mo, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, mo - 1, d, hour, minute, 0, 0)
    return dt
  } catch {
    return null
  }
}

/* ── Ticket-holder fetcher ────────────────────────────────────────── */

interface TicketHolder {
  holder_email: string
  holder_name: string
  ticket_number: string
}

async function getTicketHolders(
  supabase: any,
  eventId: string,
): Promise<TicketHolder[]> {
  const holders: TicketHolder[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('tickets')
      .select('holder_email, holder_name, ticket_number')
      .eq('event_id', eventId)
      .in('status', ['active', 'used'])
      .range(from, from + 499)
    if (error || !data || data.length === 0) break
    holders.push(...data)
    from += data.length
    if (data.length < 500) break
  }
  // Deduplicate by email (send one email per person)
  const seen = new Set<string>()
  return holders.filter((h) => {
    const key = h.holder_email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/* ── Main handler ─────────────────────────────────────────────────── */

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
  const logs: string[] = []
  const log = (msg: string) => {
    logs.push(msg)
    console.log(`[reminders] ${msg}`)
  }

  try {
    const now = nowPacific()
    const todayStr = pacificDateStr(now)
    const tomorrowStr = pacificDateStr(shiftDays(now, 1))
    const yesterdayStr = pacificDateStr(shiftDays(now, -1))

    log(`Pacific now: ${now.toISOString()}, today=${todayStr}, tomorrow=${tomorrowStr}, yesterday=${yesterdayStr}`)

    /* ────── 1. One-Day Reminder ────── */
    {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, date, time, venue, address, city, state, status, email_templates')
        .eq('date', tomorrowStr)
        .eq('reminder_enabled', true)
        .eq('reminder_1day_sent', false)
        .is('deleted_at', null)

      if (error) {
        log(`1-day query error: ${error.message}`)
      } else if (events && events.length > 0) {
        log(`1-day reminders: ${events.length} events`)
        for (const evt of events) {
          if (evt.status !== 'published' && evt.status !== 'approved') continue
          const holders = await getTicketHolders(supabase, evt.id)
          if (holders.length === 0) {
            log(`  [${evt.title}] no ticket holders — skipping`)
            continue
          }

          log(`  [${evt.title}] sending 1-day reminder to ${holders.length} holders`)
          const venueDisplay = [evt.venue, evt.city, evt.state].filter(Boolean).join(', ')
          const fullAddress = [evt.address, evt.city, evt.state].filter(Boolean).join(', ')

          for (const h of holders) {
            const ticketUrl = `${siteUrl}/ticket/${encodeURIComponent(h.ticket_number)}`
            const templateVars = {
              event_title: evt.title,
              event_date: evt.date,
              event_time: evt.time || '',
              venue: venueDisplay,
              city: evt.city || '',
              attendee_name: h.holder_name.split(' ')[0] || h.holder_name,
              ticket_number: h.ticket_number,
              ticket_url: ticketUrl,
            }
            const customSubject = resolveTemplate(evt.email_templates, 'reminder_subject', templateVars)
            const html = renderReminderEmail({
              eventTitle: evt.title,
              eventDate: evt.date,
              eventTime: evt.time || '',
              venue: venueDisplay,
              address: fullAddress,
              holderName: h.holder_name,
              ticketNumber: h.ticket_number,
              siteUrl,
            })
            await sendEmail({
              to: h.holder_email,
              subject: customSubject,
              html,
            })
          }

          await supabase
            .from('events')
            .update({ reminder_1day_sent: true })
            .eq('id', evt.id)
          log(`  [${evt.title}] 1-day reminder sent & flagged`)
        }
      } else {
        log('1-day reminders: no events qualify')
      }
    }

    /* ────── 2. Three-Hour Reminder ────── */
    {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, date, time, venue, address, city, state, status, email_templates')
        .eq('date', todayStr)
        .eq('reminder_enabled', true)
        .eq('reminder_3hr_sent', false)
        .is('deleted_at', null)

      if (error) {
        log(`3-hour query error: ${error.message}`)
      } else if (events && events.length > 0) {
        log(`3-hour check: ${events.length} events today`)
        for (const evt of events) {
          if (evt.status !== 'published' && evt.status !== 'approved') continue
          const eventTime = eventPacificTime(evt.date, evt.time)
          if (!eventTime) {
            log(`  [${evt.title}] no parseable time — skipping 3hr`)
            continue
          }

          const diffMs = eventTime.getTime() - now.getTime()
          const diffHours = diffMs / (1000 * 60 * 60)

          // Send if event starts within 1–4 hours
          if (diffHours < 0.5 || diffHours > 4) {
            log(`  [${evt.title}] starts in ${diffHours.toFixed(1)}h — not in 3hr window`)
            continue
          }

          const holders = await getTicketHolders(supabase, evt.id)
          if (holders.length === 0) {
            log(`  [${evt.title}] no ticket holders — skipping`)
            continue
          }

          log(`  [${evt.title}] sending 3hr reminder to ${holders.length} holders (starts in ${diffHours.toFixed(1)}h)`)
          const venueDisplay = [evt.venue, evt.city, evt.state].filter(Boolean).join(', ')
          const fullAddress = [evt.address, evt.city, evt.state].filter(Boolean).join(', ')

          for (const h of holders) {
            const ticketUrl = `${siteUrl}/ticket/${encodeURIComponent(h.ticket_number)}`
            const templateVars = {
              event_title: evt.title,
              event_date: evt.date,
              event_time: evt.time || '',
              venue: venueDisplay,
              city: evt.city || '',
              attendee_name: h.holder_name.split(' ')[0] || h.holder_name,
              ticket_number: h.ticket_number,
              ticket_url: ticketUrl,
            }
            const customSubject = resolveTemplate(evt.email_templates, 'starting_soon_subject', templateVars)
            const html = renderStartingSoonEmail({
              eventTitle: evt.title,
              eventTime: evt.time || '',
              venue: venueDisplay,
              address: fullAddress,
              holderName: h.holder_name,
              ticketNumber: h.ticket_number,
              siteUrl,
            })
            await sendEmail({
              to: h.holder_email,
              subject: customSubject,
              html,
            })
          }

          await supabase
            .from('events')
            .update({ reminder_3hr_sent: true })
            .eq('id', evt.id)
          log(`  [${evt.title}] 3hr reminder sent & flagged`)
        }
      } else {
        log('3-hour reminders: no events qualify')
      }
    }

    /* ────── 3. Post-Event Follow-up ────── */
    {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, date, venue, city, status, email_templates')
        .eq('date', yesterdayStr)
        .eq('reminder_enabled', true)
        .eq('reminder_followup_sent', false)
        .is('deleted_at', null)

      if (error) {
        log(`Follow-up query error: ${error.message}`)
      } else if (events && events.length > 0) {
        log(`Follow-up: ${events.length} events from yesterday`)
        for (const evt of events) {
          if (evt.status !== 'published' && evt.status !== 'approved') continue
          const holders = await getTicketHolders(supabase, evt.id)
          if (holders.length === 0) {
            log(`  [${evt.title}] no ticket holders — skipping`)
            continue
          }

          log(`  [${evt.title}] sending follow-up to ${holders.length} holders`)

          for (const h of holders) {
            const templateVars = {
              event_title: evt.title,
              event_date: evt.date,
              venue: evt.venue || '',
              city: evt.city || '',
              attendee_name: h.holder_name.split(' ')[0] || h.holder_name,
              ticket_number: h.ticket_number,
            }
            const customSubject = resolveTemplate(evt.email_templates, 'followup_subject', templateVars)
            const shortId = getShortId(evt.id)
            const html = renderFollowUpEmail({
              eventTitle: evt.title,
              holderName: h.holder_name,
              siteUrl,
              feedbackUrl: `${siteUrl}/e/${shortId}/feedback`,
            })
            await sendEmail({
              to: h.holder_email,
              subject: customSubject,
              html,
            })
          }

          await supabase
            .from('events')
            .update({ reminder_followup_sent: true })
            .eq('id', evt.id)
          log(`  [${evt.title}] follow-up sent & flagged`)
        }
      } else {
        log('Follow-up: no events qualify')
      }
    }

    return NextResponse.json({ ok: true, logs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Unexpected error: ${msg}`)
    return NextResponse.json({ ok: false, error: msg, logs }, { status: 500 })
  }
}
