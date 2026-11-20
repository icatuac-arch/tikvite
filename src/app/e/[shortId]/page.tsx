import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getShortId, getSiteUrl } from '@/lib/constants'
import type { Event } from '@/lib/types'
import type { Metadata } from 'next'
import EventBody from './EventBody'
import { formatTime } from '@/lib/formatTime'

interface PageProps {
  params: { shortId: string }
}

async function getEvent(shortId: string): Promise<Event | null> {
  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await service
    .from('events')
    .select('*')
    .is('deleted_at', null)
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)
  if (!data?.length) return null
  return (data as Event[]).find(e => getShortId(e.id) === shortId) || (data as Event[])[0] || null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getEvent(params.shortId)
  if (!event) return { title: 'Event Not Found' }

  const siteUrl = getSiteUrl()
  const url = `${siteUrl}/e/${params.shortId}`
  const dateFmt = new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const location = [event.venue, event.city, event.state].filter(Boolean).join(', ')
  const description = event.description
    ? event.description.slice(0, 160).replace(/\n/g, ' ')
    : `${event.title} on ${dateFmt} at ${location}`

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      url,
      siteName: 'Ticvite',
      type: 'website',
      locale: 'en_US',
      ...(event.image_url ? { images: [{ url: event.image_url, width: 1200, height: 630, alt: event.title }] } : {}),
    },
    twitter: {
      card: event.image_url ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      ...(event.image_url ? { images: [event.image_url] } : {}),
    },
    alternates: { canonical: url },
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { shortId } = params
  const supabase = createServerSupabaseClient()

  // shortId is the first 7 hex chars of the UUID (dashes stripped)
  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`
  // First try published events (public)
  let { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)

  // If not found as published, check if user owns a draft/pending event (preview mode)
  let isPreview = false
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
    if (allStatuses?.length) {
      events = allStatuses
      isPreview = true
    }
  }

  if (!events?.length) return notFound()

  const event =
    (events as Event[]).find((e) => getShortId(e.id) === shortId) ||
    (events as Event[])[0]

  if (!event) return notFound()

  const siteUrl = getSiteUrl()
  const shortUrl = `${siteUrl}/e/${shortId}`

  // Fetch related events — prioritize same category + metro, then same category anywhere,
  // then same metro, then any upcoming
  let relatedEvents: Event[] = []
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. Same category + same metro
    const { data: sameCatMetro } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .is('deleted_at', null)
      .eq('category', event.category)
      .eq('metro_region', event.metro_region)
      .neq('id', event.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(8)
    if (sameCatMetro?.length) relatedEvents = sameCatMetro as Event[]

    // 2. If not enough, add same metro any category
    if (relatedEvents.length < 4) {
      const existingIds = new Set(relatedEvents.map(e => e.id))
      const { data: sameMetro } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('metro_region', event.metro_region)
        .neq('id', event.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(8)
      if (sameMetro?.length) {
        for (const e of sameMetro as Event[]) {
          if (!existingIds.has(e.id)) { relatedEvents.push(e); existingIds.add(e.id) }
          if (relatedEvents.length >= 8) break
        }
      }
    }

    // 3. If still not enough, add same category from other metros
    if (relatedEvents.length < 4) {
      const existingIds = new Set(relatedEvents.map(e => e.id))
      const { data: sameCat } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('category', event.category)
        .neq('id', event.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(8)
      if (sameCat?.length) {
        for (const e of sameCat as Event[]) {
          if (!existingIds.has(e.id)) { relatedEvents.push(e); existingIds.add(e.id) }
          if (relatedEvents.length >= 8) break
        }
      }
    }
  } catch {
    // non-critical
  }

  // Schema.org Event structured data for Google rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || event.title,
    startDate: event.time
      ? `${event.date}T${parseTimeToISO(event.time)}`
      : event.date,
    ...(event.image_url ? { image: [event.image_url] } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venue || event.city,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address || '',
        addressLocality: event.city,
        addressRegion: event.state,
        postalCode: event.zip_code || '',
        addressCountry: 'US',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: event.publisher_name || 'Ticvite',
      url: siteUrl,
    },
    offers: {
      '@type': 'Offer',
      url: shortUrl,
      availability: 'https://schema.org/InStock',
      ...(event.price === 'Free'
        ? { price: '0', priceCurrency: 'USD' }
        : { price: event.price?.replace(/[^0-9.]/g, '') || '0', priceCurrency: 'USD' }),
    },
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      

      {/* Preview banner for draft/pending events */}
      {isPreview && (
        <div className="w-full py-2 px-4 text-center text-sm font-medium" style={{ backgroundColor: '#7C3AED', color: '#F8FAFC' }}>
          Preview Mode — This event is not live yet ({event.status === 'draft' ? 'Draft' : event.status === 'pending' ? 'Pending Approval' : event.status})
        </div>
      )}

      <main className="flex-1 w-full">
        <EventBody
          event={event}
          shortId={shortId}
          shortUrl={shortUrl}
          relatedEvents={relatedEvents}
        />
      </main>

      
    </div>
  )
}

function parseTimeToISO(timeStr: string): string {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
  if (!m) return '19:00:00'
  let hours = parseInt(m[1], 10)
  const minutes = m[2]
  const meridiem = m[3]?.toUpperCase()
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${minutes}:00`
}
