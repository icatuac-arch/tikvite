/**
 * Ticket PDF download API.
 * GET /api/tickets/pdf?ticket_number=IP-...
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { buildTicketQrUrl } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ticketNumber = url.searchParams.get('ticket_number')

  if (!ticketNumber) {
    return NextResponse.json({ ok: false, error: 'Missing ticket_number' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, events(title, date, time, venue, address, city, state), event_tiers(name)')
    .eq('ticket_number', ticketNumber)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 })
  }

  const event = (ticket as any).events
  const tier = (ticket as any).event_tiers

  // Generate QR code as PNG buffer
  const qrUrl = buildTicketQrUrl(ticket.qr_token)
  const qrPngBuffer = await QRCode.toBuffer(qrUrl, { width: 200, margin: 1, errorCorrectionLevel: 'M' })

  // Build PDF — 8.5 x 4 inches (ticket shaped)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 288]) // 8.5 x 4 inches at 72 DPI
  const { width, height } = page.getSize()

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Colors
  const maroon = rgb(0.482, 0.122, 0.122) // #4F46E5
  const gold = rgb(0.788, 0.482, 0.102)   // #7C3AED
  const darkGray = rgb(0.2, 0.2, 0.2)
  const medGray = rgb(0.45, 0.45, 0.45)
  const cream = rgb(0.992, 0.973, 0.941)   // #F8FAFC

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: cream })

  // Left maroon accent bar
  page.drawRectangle({ x: 0, y: 0, width: 6, height, color: maroon })

  // Dashed vertical separator (QR section on right)
  const sepX = width - 190
  for (let y = 10; y < height - 10; y += 8) {
    page.drawRectangle({ x: sepX, y, width: 1, height: 4, color: rgb(0.82, 0.78, 0.72) })
  }

  // Left section — event + holder info
  const leftMargin = 24
  let y = height - 36

  // Event title
  const titleText = event?.title || 'Event'
  const titleSize = titleText.length > 40 ? 16 : 20
  page.drawText(titleText.substring(0, 60), { x: leftMargin, y, font: helveticaBold, size: titleSize, color: maroon, maxWidth: sepX - leftMargin - 20 })
  y -= 24

  // Date & time
  if (event?.date) {
    const dateStr = event.date + (event.time ? ` at ${event.time}` : '')
    page.drawText(dateStr, { x: leftMargin, y, font: helvetica, size: 11, color: darkGray })
    y -= 16
  }

  // Venue
  if (event?.venue) {
    page.drawText(event.venue, { x: leftMargin, y, font: helvetica, size: 11, color: darkGray })
    y -= 16
  }

  // Address
  if (event?.address) {
    const addr = `${event.address}${event.city ? `, ${event.city}` : ''}${event.state ? `, ${event.state}` : ''}`
    page.drawText(addr.substring(0, 70), { x: leftMargin, y, font: helvetica, size: 9, color: medGray })
    y -= 16
  }

  // Divider line
  y -= 8
  page.drawRectangle({ x: leftMargin, y, width: sepX - leftMargin - 20, height: 1, color: rgb(0.82, 0.78, 0.72) })
  y -= 20

  // Holder name
  page.drawText('TICKET HOLDER', { x: leftMargin, y, font: helvetica, size: 8, color: medGray })
  y -= 14
  page.drawText(ticket.holder_name.substring(0, 40), { x: leftMargin, y, font: helveticaBold, size: 14, color: darkGray })
  y -= 22

  // Tier (if any)
  if (tier?.name) {
    page.drawText('TIER', { x: leftMargin, y, font: helvetica, size: 8, color: medGray })
    y -= 14
    page.drawText(tier.name, { x: leftMargin, y, font: helvetica, size: 11, color: darkGray })
    y -= 20
  }

  // Ticket number
  page.drawText('TICKET NUMBER', { x: leftMargin, y, font: helvetica, size: 8, color: medGray })
  y -= 14
  page.drawText(ticket.ticket_number, { x: leftMargin, y, font: helveticaBold, size: 13, color: maroon })

  // Bottom branding
  page.drawText('Ticvite.com', { x: leftMargin, y: 14, font: helvetica, size: 8, color: gold })

  // Right section — QR code
  const qrImage = await pdfDoc.embedPng(qrPngBuffer)
  const qrSize = 140
  const qrX = sepX + (190 - qrSize) / 2
  const qrY = (height - qrSize) / 2 + 10
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // "Scan to verify" below QR
  const scanText = 'Scan to verify'
  const scanWidth = helvetica.widthOfTextAtSize(scanText, 8)
  page.drawText(scanText, { x: sepX + (190 - scanWidth) / 2, y: qrY - 14, font: helvetica, size: 8, color: medGray })

  // Serialize
  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ticket.ticket_number}.pdf"`,
    },
  })
}
