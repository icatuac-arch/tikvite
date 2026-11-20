import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getShortId } from '@/lib/constants'
import RsvpForm from '@/components/RsvpForm'
import type { EventTier, EventRsvp } from '@/lib/rsvp'
import { computeTierOccupancy } from '@/lib/rsvp'
import type { Metadata } from 'next'

interface PageProps {
  params: { shortId: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function EmbedTicketPage({ params, searchParams }: PageProps) {
  const { shortId } = params
  const supabase = createServerSupabaseClient()

  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`

  let { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)

  if (!events?.length) {
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: allStatuses } = await service
      .from('events')
      .select('*')
      .is('deleted_at', null)
      .gte('id', lo)
      .lte('id', hi)
      .limit(16)
    if (allStatuses?.length) events = allStatuses
  }

  if (!events?.length) return notFound()
  const event =
    events.find((e: any) => getShortId(e.id) === shortId) || events[0]
  if (!event) return notFound()

  // Redirect to seat picker for reserved seating events
  if ((event as any).seating_mode === 'reserved') {
    redirect(`/e/${shortId}/seats`)
  }

  // Redirect to queue if queue is enabled
  if ((event as any).queue_enabled && !searchParams?.admitted) {
    redirect(`/e/${shortId}/queue`)
  }

  const rsvpEnabled: boolean = (event as any).rsvp_enabled === true
  const rsvpDeadline: string | null = (event as any).rsvp_deadline
  const deadlinePassed = rsvpDeadline ? new Date(rsvpDeadline) < new Date() : false

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let { data: tiers } = await service
    .from('event_tiers')
    .select('*')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })

  // Safety net: auto-create default tier if none exists
  if (rsvpEnabled && (!tiers || tiers.length === 0)) {
    const { data: newTier } = await service
      .from('event_tiers')
      .insert({
        event_id: event.id,
        name: 'General Admission',
        price: 0,
        capacity: null,
        sort_order: 0,
      })
      .select('*')
      .single()
    tiers = newTier ? [newTier] : []
  }

  // Fetch RSVPs to compute occupancy
  const { data: rsvps } = await service
    .from('event_rsvps')
    .select('id, event_id, tier_id, status, quantity')
    .eq('event_id', event.id)

  const occupancy = computeTierOccupancy(
    (tiers as EventTier[]) || [],
    (rsvps as EventRsvp[]) || [],
  )

  const occupancyMap: Record<string, { seatsLeft: number | null; seatsTaken: number; waitlistCount: number }> = {}
  for (const o of occupancy) {
    occupancyMap[o.tier.id] = {
      seatsLeft: o.seatsLeft,
      seatsTaken: o.seatsTaken,
      waitlistCount: o.waitlistCount,
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'transparent',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
        {!rsvpEnabled ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              color: '#475569',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎫</div>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                marginBottom: '4px',
                color: '#0F172A',
                fontFamily: 'Plus Jakarta Sans, serif',
              }}
            >
              Registration not open
            </h2>
            <p style={{ fontSize: '0.875rem' }}>
              RSVP isn&apos;t available for this event yet. Check back later.
            </p>
          </div>
        ) : deadlinePassed ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              color: '#475569',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏰</div>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                marginBottom: '4px',
                color: '#0F172A',
                fontFamily: 'Plus Jakarta Sans, serif',
              }}
            >
              Registration closed
            </h2>
            <p style={{ fontSize: '0.875rem' }}>
              The RSVP deadline for this event has passed.
            </p>
          </div>
        ) : (
          <RsvpForm
            eventId={event.id}
            eventTitle={event.title}
            eventShortId={shortId}
            paymentLink={(event as any).payment_link || ''}
            paymentInstructions={(event as any).payment_instructions || ''}
            tiers={(tiers as EventTier[] | null) || []}
            occupancyMap={occupancyMap}
            feePassToBuyer={(event as any).fee_pass_to_buyer || false}
            platformFeePerTicket={0}
          />
        )}
      </div>
    </div>
  )
}
