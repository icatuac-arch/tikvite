import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import OrganizerProfileClient from '@/components/OrganizerProfileClient'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = params
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: profile } = await supabase
    .from('organizer_profiles')
    .select('display_name, bio, avatar_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!profile) return { title: 'Organizer Not Found' }
  return {
    title: `${(profile as any).display_name} · Tikvite`,
    description: (profile as any).bio || `Events by ${(profile as any).display_name}`,
    openGraph: {
      images: (profile as any).avatar_url ? [(profile as any).avatar_url] : [],
    },
  }
}

export default async function OrganizerPublicPage({ params }: Props) {
  const { slug } = params
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: profile } = await supabase
    .from('organizer_profiles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!profile) return notFound()

  // Fetch upcoming published events
  const today = new Date().toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('id, title, date, time, venue, city, image_url, category, price, rsvp_enabled')
    .eq('publisher_id', (profile as any).user_id)
    .eq('is_published', true)
    .is('deleted_at', null)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(20)

  return (
    <OrganizerProfileClient
      profile={profile as any}
      events={(events as any[]) ?? []}
      slug={slug}
    />
  )
}
