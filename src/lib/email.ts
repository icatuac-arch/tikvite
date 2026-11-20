/**
 * Tiny email helper.
 *
 * Prefers Resend (https://resend.com) if RESEND_API_KEY is set — otherwise
 * logs the outgoing email to the server console so nothing crashes when
 * a provider isn't configured yet. Callers should never rely on the
 * return value; email sending is fire-and-forget.
 */

interface SendArgs {
  to: string
  subject: string
  html: string
  text?: string
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'Ticvite <no-reply@ticvite.com>'

export async function sendEmail(args: SendArgs): Promise<void> {
  // No provider — surface the content in server logs and move on.
  if (!RESEND_API_KEY) {
    console.log('[email:no-provider] to=%s subject=%s', args.to, args.subject)
    console.log(args.text || args.html.replace(/<[^>]+>/g, ''))
    return
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    })
    if (!resp.ok) {
      const body = await resp.text()
      console.warn('[email] resend failed', resp.status, body)
    }
  } catch (err: any) {
    console.warn('[email] send error', err?.message)
  }
}

/** Escape user-supplied strings before dropping them into an HTML template. */
export function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Render a ticket confirmation email with inline QR codes. */
export function renderTicketEmail(opts: {
  eventTitle: string
  eventDate: string
  eventVenue: string
  tickets: { ticketNumber: string; qrDataUrl: string }[]
}): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
  const ticketBlocks = opts.tickets
    .map(
      (t) => `
      <div style="margin:16px 0;padding:16px;background:#F1F5F9;border-radius:12px;text-align:center;">
        <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Ticket Number</div>
        <div style="font-size:18px;font-weight:700;font-family:ui-monospace,monospace;color:#4F46E5;letter-spacing:0.06em;margin-bottom:12px;">${escapeHtml(t.ticketNumber)}</div>
        <img src="${t.qrDataUrl}" alt="QR Code" width="200" height="200" style="border-radius:8px;display:block;margin:0 auto;" />
        <div style="font-size:11px;color:#94A3B8;margin-top:6px;">Scan at entry for check-in</div>
        <div style="margin-top:10px;">
          <a href="${siteUrl}/ticket/${encodeURIComponent(t.ticketNumber)}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-right:8px;">View Ticket</a>
          <a href="${siteUrl}/api/tickets/pdf?ticket_number=${encodeURIComponent(t.ticketNumber)}" style="display:inline-block;background:#7C3AED;color:#F8FAFC;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Download PDF</a>
        </div>
      </div>`,
    )
    .join('')

  return renderEmail('Your Tickets Are Ready', `
    <p style="font-size:16px;font-weight:600;color:#4F46E5;margin-bottom:4px;">${escapeHtml(opts.eventTitle)}</p>
    <p style="font-size:14px;color:#475569;margin:0 0 4px;">${escapeHtml(opts.eventDate)}</p>
    <p style="font-size:14px;color:#475569;margin:0 0 16px;">${escapeHtml(opts.eventVenue)}</p>
    <p style="font-size:14px;color:#334155;">Your tickets are confirmed! Show the QR code below at the venue entrance.</p>
    ${ticketBlocks}
    <p style="font-size:12px;color:#94A3B8;margin-top:16px;">Keep this email — you can also access your tickets anytime at ticvite.com</p>
  `)
}

/* ── Reminder email templates ────────────────────────────────────── */

/** "Your event is tomorrow!" — 1-day reminder email. */
export function renderReminderEmail(opts: {
  eventTitle: string
  eventDate: string
  eventTime: string
  venue: string
  address: string
  holderName: string
  ticketNumber: string
  siteUrl: string
}): string {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.address)}`
  const ticketUrl = `${opts.siteUrl}/ticket/${encodeURIComponent(opts.ticketNumber)}`

  return renderEmail("Event Reminder", `
    <p style="font-size:15px;color:#334155;">Hi ${escapeHtml(opts.holderName.split(' ')[0] || 'there')},</p>
    <p style="font-size:15px;color:#334155;">Just a friendly reminder — <strong>${escapeHtml(opts.eventTitle)}</strong> is <strong>tomorrow</strong>!</p>

    <div style="margin:20px 0;padding:18px;background:#F1F5F9;border-radius:12px;border-left:4px solid #7C3AED;">
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#334155;">
        <tr><td style="padding:4px 0;font-weight:600;width:80px;vertical-align:top;">Event</td><td style="padding:4px 0;">${escapeHtml(opts.eventTitle)}</td></tr>
        <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Date</td><td style="padding:4px 0;">${escapeHtml(opts.eventDate)}</td></tr>
        ${opts.eventTime ? `<tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Time</td><td style="padding:4px 0;">${escapeHtml(opts.eventTime)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Venue</td><td style="padding:4px 0;">${escapeHtml(opts.venue)}</td></tr>
        ${opts.address ? `<tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Address</td><td style="padding:4px 0;">${escapeHtml(opts.address)}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${ticketUrl}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;margin-right:10px;">View Your Ticket</a>
      ${opts.address ? `<a href="${mapsUrl}" style="display:inline-block;background:#7C3AED;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;" target="_blank">Get Directions</a>` : ''}
    </div>

    <p style="font-size:13px;color:#94A3B8;margin-top:16px;">Tip: Add this event to your phone calendar so you don't forget!</p>
    <p style="font-size:14px;color:#334155;">See you there!</p>
  `)
}

/** "Starting in 3 hours!" — urgent pre-event reminder email. */
export function renderStartingSoonEmail(opts: {
  eventTitle: string
  eventTime: string
  venue: string
  address: string
  holderName: string
  ticketNumber: string
  siteUrl: string
}): string {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.address)}`
  const ticketUrl = `${opts.siteUrl}/ticket/${encodeURIComponent(opts.ticketNumber)}`

  return renderEmail("Starting Soon!", `
    <p style="font-size:15px;color:#334155;">Hi ${escapeHtml(opts.holderName.split(' ')[0] || 'there')},</p>
    <p style="font-size:16px;color:#4F46E5;font-weight:700;"><strong>${escapeHtml(opts.eventTitle)}</strong> starts soon!</p>

    <div style="margin:20px 0;padding:18px;background:#EEF2FF;border-radius:12px;border-left:4px solid #4F46E5;">
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#334155;">
        ${opts.eventTime ? `<tr><td style="padding:4px 0;font-weight:600;width:80px;">Time</td><td style="padding:4px 0;font-weight:700;color:#4F46E5;">${escapeHtml(opts.eventTime)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;font-weight:600;width:80px;">Venue</td><td style="padding:4px 0;">${escapeHtml(opts.venue)}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${ticketUrl}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;margin-right:10px;">View Your Ticket</a>
      ${opts.address ? `<a href="${mapsUrl}" style="display:inline-block;background:#7C3AED;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;" target="_blank">Get Directions</a>` : ''}
    </div>

    <p style="font-size:14px;color:#334155;">Have your ticket QR code ready for a smooth check-in. See you soon!</p>
  `)
}

/** "Thanks for attending!" — post-event follow-up email. */
export function renderFollowUpEmail(opts: {
  eventTitle: string
  holderName: string
  siteUrl: string
  feedbackUrl?: string
}): string {
  return renderEmail("Thanks for Attending!", `
    <p style="font-size:15px;color:#334155;">Hi ${escapeHtml(opts.holderName.split(' ')[0] || 'there')},</p>
    <p style="font-size:15px;color:#334155;">We hope you enjoyed <strong>${escapeHtml(opts.eventTitle)}</strong>! It was wonderful having you there.</p>

    ${opts.feedbackUrl ? `<div style="margin:20px 0;padding:18px;background:#EEF2FF;border-radius:12px;text-align:center;border:1px solid #E2E8F0;">
      <p style="font-size:14px;color:#475569;margin:0 0 12px;">How was your experience?</p>
      <a href="${opts.feedbackUrl}" style="display:inline-block;background:#4F46E5;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Rate this event</a>
    </div>` : ''}

    <div style="margin:20px 0;padding:18px;background:#F1F5F9;border-radius:12px;text-align:center;">
      <p style="font-size:14px;color:#475569;margin:0 0 16px;">Looking for more events in your area?</p>
      <a href="${opts.siteUrl}" style="display:inline-block;background:#2E7D32;color:#F8FAFC;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Discover More Events</a>
    </div>

    <p style="font-size:14px;color:#334155;">Thank you for being part of the community. We look forward to seeing you at the next event!</p>
    <p style="font-size:14px;color:#475569;">Warm regards,<br/>The Ticvite Team</p>
  `)
}

/** Wrap body content in a simple centered-card HTML shell. */
export function renderEmail(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F8FAFC;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#0F172A;">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:#4F46E5;padding:20px 28px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.02em;">Ticvite</div>
        <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">Your Event. Your Tickets. Zero Platform Fees.</div>
      </div>
      <div style="padding:28px;">
        <div style="text-align:center;color:#475569;font-size:13px;margin-bottom:20px;">${escapeHtml(title)}</div>
        <div style="font-size:15px;line-height:1.55;color:#0F172A;">${bodyHtml}</div>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;text-align:center;background:#F8FAFC;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'}" style="color:#4F46E5;text-decoration:none;font-weight:600;">ticvite.com</a>
      </div>
    </div>
  </body>
</html>`
}
