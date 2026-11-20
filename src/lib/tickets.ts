import { randomBytes } from 'crypto'
import QRCode from 'qrcode'
import { sendEmail, renderTicketEmail } from '@/lib/email'

const TICKET_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function generateTicketNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const bytes = randomBytes(8)
  let suffix = ''
  for (let i = 0; i < 8; i++) {
    suffix += TICKET_CHARS[bytes[i] % TICKET_CHARS.length]
  }
  return `TK-${yy}${mm}-${suffix}`
}

export function generateQrToken(): string {
  return randomBytes(32).toString('base64url')
}

export function buildTicketQrUrl(qrToken: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
  return `${base}/ticket/verify?t=${qrToken}`
}

// Generate QR code as data URL for embedding in emails/pages
export async function generateQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
}

// Generate QR code as PNG buffer for PDF embedding
export async function generateQrBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
}

/**
 * Shared helper: create ticket rows for an RSVP, generate QR codes,
 * and send the ticket confirmation email. Used by both the free RSVP
 * endpoint and the Stripe webhook handler.
 */
export async function createTicketsForRsvp(
  supabase: any,
  opts: {
    eventId: string
    rsvpId: string
    tierId: string | null
    holderName: string
    holderEmail: string
    quantity: number
    eventTitle: string
    eventDate: string
    eventVenue: string
    guestNames?: string[]
  },
) {
  const ticketRows: {
    event_id: string
    rsvp_id: string
    tier_id: string | null
    holder_name: string
    holder_email: string
    ticket_number: string
    qr_token: string
    status: string
  }[] = []

  for (let i = 0; i < opts.quantity; i++) {
    // First ticket goes to the buyer, rest to named guests (if provided)
    const name = i === 0
      ? opts.holderName
      : (opts.guestNames && opts.guestNames[i - 1]) || opts.holderName

    ticketRows.push({
      event_id: opts.eventId,
      rsvp_id: opts.rsvpId,
      tier_id: opts.tierId,
      holder_name: name,
      holder_email: opts.holderEmail,
      ticket_number: generateTicketNumber(),
      qr_token: generateQrToken(),
      status: 'active',
    })
  }

  if (ticketRows.length > 0) {
    await supabase.from('tickets').insert(ticketRows)
  }

  // Send ticket email (fire-and-forget)
  ;(async () => {
    try {
      const ticketEmailData = await Promise.all(
        ticketRows.map(async (t) => ({
          ticketNumber: t.ticket_number,
          qrDataUrl: await generateQrDataUrl(buildTicketQrUrl(t.qr_token)),
        })),
      )
      const ticketHtml = renderTicketEmail({
        eventTitle: opts.eventTitle,
        eventDate: opts.eventDate,
        eventVenue: opts.eventVenue,
        tickets: ticketEmailData,
      })
      await sendEmail({
        to: opts.holderEmail,
        subject: `Your Tickets — ${opts.eventTitle}`,
        html: ticketHtml,
      })
    } catch (e: any) {
      console.warn('[email] ticket email error', e?.message)
    }
  })()

  return ticketRows
}
