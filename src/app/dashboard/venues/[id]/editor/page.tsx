import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import SeatMapEditor from '@/components/seating/SeatMapEditor'
import type { Venue, VenueLayout, LayoutSection, LayoutRow, LayoutSeat } from '@/lib/seating-types'

interface PageProps {
  params: { id: string }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export default async function VenueEditorPage({ params }: PageProps) {
  const { id: venueId } = params
  if (!venueId) return notFound()

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch venue
  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .single()

  if (!venue) return notFound()

  // Fetch the active layout (or most recent)
  const { data: layouts } = await supabase
    .from('venue_layouts')
    .select('*')
    .eq('venue_id', venueId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  let layout: VenueLayout
  if (layouts && layouts.length > 0) {
    layout = layouts[0] as VenueLayout
  } else {
    // Create a default layout
    const { data: newLayout, error } = await supabase
      .from('venue_layouts')
      .insert({
        venue_id: venueId,
        name: 'Default Layout',
        version: 1,
        width: 800,
        height: 600,
        stage_position: 'top',
        is_active: true,
      })
      .select('*')
      .single()

    if (error || !newLayout) return notFound()
    layout = newLayout as VenueLayout
  }

  // Fetch sections, rows, seats for this layout
  const [
    { data: sections },
    { data: rows },
    { data: seats },
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
  ])

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      
      <SeatMapEditor
        venue={venue as Venue}
        layout={layout}
        initialSections={(sections || []) as LayoutSection[]}
        initialRows={(rows || []) as LayoutRow[]}
        initialSeats={(seats || []) as LayoutSeat[]}
      />
    </div>
  )
}
