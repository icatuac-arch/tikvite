import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getShortId } from '@/lib/constants'
import QueueClient from './QueueClient'

interface PageProps {
  params: { shortId: string }
}

export default async function QueuePage({ params }: PageProps) {
  const { shortId } = params
  const supabase = createServerSupabaseClient()

  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`
  const { data: events } = await supabase
    .from('events')
    .select('id, title, queue_enabled')
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)

  if (!events?.length) return notFound()
  const event = events.find((e: any) => getShortId(e.id) === shortId) || events[0]
  if (!event) return notFound()

  // If queue isn't enabled, send them straight to RSVP
  if (!(event as any).queue_enabled) {
    redirect(`/e/${shortId}/rsvp`)
  }

  return (
    <QueueClient
      eventId={event.id}
      eventTitle={(event as any).title}
      shortId={shortId}
    />
  )
}
