import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) {
    return new NextResponse('Not authenticated', { status: 401 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch event
  const { data: event } = await service.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) {
    return new NextResponse('Event not found', { status: 404 })
  }

  // Ownership check
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return new NextResponse('Not authorized', { status: 403 })
    }
  }

  // Fetch RSVPs + tickets + tiers
  const [{ data: rsvps }, { data: tickets }, { data: tiers }] = await Promise.all([
    service.from('event_rsvps').select('*').eq('event_id', id).order('attendee_name', { ascending: true }),
    service.from('tickets').select('*').eq('event_id', id),
    service.from('event_tiers').select('id, name').eq('event_id', id),
  ])

  const tierMap = new Map<string, string>()
  for (const t of (tiers || [])) {
    tierMap.set(t.id, t.name)
  }

  // Build rows: join RSVPs with their tickets
  interface CheckinRow {
    name: string
    email: string
    tier: string
    ticketNumber: string
    status: string
    checkedIn: string
  }

  const rows: CheckinRow[] = []

  for (const rsvp of (rsvps || [])) {
    const rsvpTickets = (tickets || []).filter((t: any) => t.rsvp_id === rsvp.id)
    if (rsvpTickets.length > 0) {
      for (const t of rsvpTickets) {
        rows.push({
          name: rsvp.attendee_name || '',
          email: rsvp.attendee_email || '',
          tier: tierMap.get(rsvp.tier_id) || 'General',
          ticketNumber: t.ticket_number || '',
          status: t.status || 'active',
          checkedIn: t.checked_in_at
            ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : '',
        })
      }
    } else {
      rows.push({
        name: rsvp.attendee_name || '',
        email: rsvp.attendee_email || '',
        tier: tierMap.get(rsvp.tier_id) || 'General',
        ticketNumber: '',
        status: rsvp.status || '',
        checkedIn: rsvp.checked_in_at
          ? new Date(rsvp.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '',
      })
    }
  }

  // Sort by name
  rows.sort((a, b) => a.name.localeCompare(b.name))

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 792 // letter landscape
  const pageHeight = 612
  const margin = 40
  const headerHeight = 80
  const rowHeight = 18
  const fontSize = 9
  const headerFontSize = 11

  // Column widths
  const cols = [
    { label: '#', width: 30 },
    { label: 'Name', width: 140 },
    { label: 'Email', width: 180 },
    { label: 'Tier', width: 90 },
    { label: 'Ticket #', width: 120 },
    { label: 'Status', width: 70 },
    { label: 'Checked In', width: 80 },
  ]

  let pageNum = 0
  let y = 0
  let page: any = null

  const drawHeader = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    pageNum++
    y = pageHeight - margin

    // Event title
    page.drawText(truncate(event.title, 80), {
      x: margin,
      y,
      size: 16,
      font: fontBold,
      color: rgb(0.48, 0.12, 0.12),
    })
    y -= 18

    // Event details
    const details = [event.date, event.time, event.venue, event.city].filter(Boolean).join('  |  ')
    page.drawText(truncate(details, 100), {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.35, 0.27),
    })
    y -= 14

    // Total count
    page.drawText(`Total attendees: ${rows.length}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.35, 0.27),
    })
    y -= 22

    // Table header
    let x = margin
    for (const col of cols) {
      page.drawText(col.label, {
        x,
        y,
        size: headerFontSize,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      })
      x += col.width
    }
    y -= 4

    // Header line
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.65, 0.55),
    })
    y -= rowHeight
  }

  const drawFooter = () => {
    if (!page) return
    page.drawText(`Page ${pageNum}`, {
      x: pageWidth / 2 - 20,
      y: margin / 2,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    page.drawText('ticvite.com', {
      x: pageWidth - margin - 80,
      y: margin / 2,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
  }

  // Draw rows
  drawHeader()

  for (let i = 0; i < rows.length; i++) {
    if (y < margin + 30) {
      drawFooter()
      drawHeader()
    }

    const row = rows[i]
    let x = margin
    const values = [
      String(i + 1),
      truncate(row.name, 22),
      truncate(row.email, 28),
      truncate(row.tier, 14),
      row.ticketNumber,
      row.status,
      row.checkedIn,
    ]

    // Alternating row background
    if (i % 2 === 0 && page) {
      page.drawRectangle({
        x: margin - 2,
        y: y - 3,
        width: pageWidth - 2 * margin + 4,
        height: rowHeight,
        color: rgb(0.96, 0.94, 0.9),
      })
    }

    for (let c = 0; c < cols.length; c++) {
      page!.drawText(values[c] || '', {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15),
      })
      x += cols[c].width
    }

    // Checkbox column (empty box for manual check-in)
    y -= rowHeight
  }

  drawFooter()

  const pdfBytes = await pdfDoc.save()
  const filename = `checkin-list-${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '...' : str
}
