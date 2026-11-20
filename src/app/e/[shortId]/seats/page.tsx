import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getShortId } from '@/lib/constants'
import SeatSelector from '@/components/seating/SeatSelector'
import type { Event } from '@/lib/types'
import type {
  VenueLayout, LayoutSection, LayoutRow, LayoutSeat, SessionSeat,
} from '@/lib/seating-types'

interface PageProps {
  params: { shortId: string }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export default async function SeatSelectionPage({ params }: PageProps) {
  const { shortId } = params
  if (!shortId) return notFound()

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Resolve event from shortId (same pattern as event page)
  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)

  if (!events?.length) return notFound()

  const event =
    (events as Event[]).find((e) => getShortId(e.id) === shortId) ||
    (events as Event[])[0]
  if (!event) return notFound()

  // Look up the venue layout linked to this event
  // We try: events.venue_layout_id, or look up by venue name
  const eventAny = event as any

  let layoutId = eventAny.venue_layout_id
  let layout: VenueLayout | null = null

  if (layoutId) {
    const { data } = await supabase
      .from('venue_layouts')
      .select('*')
      .eq('id', layoutId)
      .single()
    layout = data as VenueLayout | null
  }

  // Fallback: find a layout by matching venue name
  if (!layout && event.venue) {
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .ilike('name', event.venue)
      .limit(1)

    if (venues?.length) {
      const { data } = await supabase
        .from('venue_layouts')
        .select('*')
        .eq('venue_id', venues[0].id)
        .eq('is_active', true)
        .limit(1)
        .single()
      layout = data as VenueLayout | null
    }
  }

  if (!layout) return notFound()

  // Fetch layout tree + session seats
  const [
    { data: sections },
    { data: rows },
    { data: seats },
    { data: sessionSeats },
    { data: tiers },
  ] = await Promise.all([
    supabase
      .from('layout_sections')
      .select('*')
      .eq('layout_id', layout.id)
      .order('sort_order'),
    supabase
      .from('layout_rows')
      .select('*')
      .eq('layout_id', layout.id)
      .order('sort_order'),
    supabase
      .from('layout_seats')
      .select('*')
      .eq('layout_id', layout.id)
      .order('sort_order'),
    supabase
      .from('session_seats')
      .select('*')
      .eq('event_id', event.id),
    supabase
      .from('event_tiers')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order'),
  ])

  // Build price map from tiers or use defaults
  const tierPrices: Record<string, number> = {}
  if (tiers?.length) {
    for (const tier of tiers) {
      // Map tier name to price zone
      const zoneName = (tier.name || '').toLowerCase()
      tierPrices[zoneName] = Math.round((tier.price || 0) * 100) // cents
    }
  }
  // Defaults for any missing zones
  if (!tierPrices.standard) tierPrices.standard = 2500
  if (!tierPrices.premium) tierPrices.premium = 5000
  if (!tierPrices.gold) tierPrices.gold = 7500
  if (!tierPrices.vip) tierPrices.vip = 10000
  if (!tierPrices.economy) tierPrices.economy = 1500

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      

      <main className="flex-1 w-full">
        <SeatSelector
          eventId={event.id}
          eventTitle={event.title}
          shortId={shortId}
          layout={layout}
          sections={(sections || []) as LayoutSection[]}
          rows={(rows || []) as LayoutRow[]}
          seats={(seats || []) as LayoutSeat[]}
          sessionSeats={(sessionSeats || []) as SessionSeat[]}
          tierPrices={tierPrices}
        />
      </main>

      
    </div>
  )
}
