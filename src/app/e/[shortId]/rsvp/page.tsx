import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getShortId } from '@/lib/constants'
import RsvpForm from '@/components/RsvpForm'
import type { EventTier, EventRsvp } from '@/lib/rsvp'
import { computeTierOccupancy } from '@/lib/rsvp'
import { formatTime } from '@/lib/formatTime'
import { Calendar, Clock, MapPin, Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: { shortId: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function EventRsvpPage({ params, searchParams }: PageProps) {
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

  // Build occupancy map: tierId -> { seatsLeft, seatsTaken, waitlistCount }
  const occupancyMap: Record<string, { seatsLeft: number | null; seatsTaken: number; waitlistCount: number }> = {}
  for (const o of occupancy) {
    occupancyMap[o.tier.id] = {
      seatsLeft: o.seatsLeft,
      seatsTaken: o.seatsTaken,
      waitlistCount: o.waitlistCount,
    }
  }

  const locationParts = [event.venue, event.city, event.state].filter(Boolean)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Back link */}
          <Link
            href={`/e/${shortId}`}
            className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}
          >
            <ArrowLeft size={16} />
            Back to event
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* ── Left column: Event Summary ── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Event poster */}
              {event.image_url && (
                <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Event info card */}
              <div
                className="rounded-2xl p-5 border space-y-4"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
              >
                <h1
                  className="text-xl sm:text-2xl font-bold leading-tight"
                  style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
                >
                  {event.title}
                </h1>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#EEF2FF' }}
                    >
                      <Calendar size={16} style={{ color: '#4F46E5' }} />
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="text-sm font-medium" style={{ color: '#0F172A' }}>
                        {formatDate(event.date)}
                      </div>
                      {event.time && (
                        <div className="text-xs" style={{ color: '#475569' }}>
                          {formatTime(event.time)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#EEF2FF' }}
                    >
                      <MapPin size={16} style={{ color: '#4F46E5' }} />
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      {event.venue && (
                        <div className="text-sm font-medium" style={{ color: '#0F172A' }}>
                          {event.venue}
                        </div>
                      )}
                      <div className="text-xs" style={{ color: '#475569' }}>
                        {[event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust indicators — desktop only */}
              <div
                className="hidden lg:flex rounded-2xl p-4 border items-center gap-3"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
              >
                <Shield size={18} style={{ color: '#2D7A3A' }} />
                <div style={{ fontFamily: 'Inter, sans-serif' }}>
                  <div className="text-xs font-medium" style={{ color: '#0F172A' }}>
                    Secure & verified
                  </div>
                  <div className="text-[11px]" style={{ color: '#475569' }}>
                    Your information is protected. Tickets delivered instantly via email.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column: Ticket Form ── */}
            <div className="lg:col-span-3">
              {!rsvpEnabled ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    fontFamily: 'Inter, sans-serif',
                    color: '#475569',
                  }}
                >
                  <div className="text-4xl mb-3">🎫</div>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}>
                    Registration not open
                  </h2>
                  <p className="text-sm">RSVP isn&apos;t available for this event yet. Check back later.</p>
                </div>
              ) : deadlinePassed ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    fontFamily: 'Inter, sans-serif',
                    color: '#475569',
                  }}
                >
                  <div className="text-4xl mb-3">⏰</div>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}>
                    Registration closed
                  </h2>
                  <p className="text-sm">The RSVP deadline for this event has passed.</p>
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
        </div>
      </main>
      
    </div>
  )
}
