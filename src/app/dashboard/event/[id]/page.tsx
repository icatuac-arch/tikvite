import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEventChecklist } from '@/lib/event-checklist'
import EventSettingsClient from './EventSettingsClient'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function EventSettingsPage({ params }: PageProps) {
  const { id } = params

  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return redirect(`/login?next=${encodeURIComponent(`/dashboard/event/${id}`)}`)

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: event } = await service.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) return notFound()

  // Ownership check with admin bypass
  let isAdmin = false
  if ((event as any).publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return notFound()
    isAdmin = true
  }

  const [{ data: tiers }, { data: rsvps }, { data: tickets }, { data: profile }] = await Promise.all([
    service.from('event_tiers').select('*').eq('event_id', id).order('sort_order', { ascending: true }),
    service.from('event_rsvps').select('id').eq('event_id', id),
    service.from('tickets').select('id').eq('event_id', id),
    service.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const checklist = getEventChecklist(event as any, (tiers as any[]) || [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <EventSettingsClient
          event={event as any}
          tiers={(tiers as any[]) || []}
          checklist={checklist}
          rsvpCount={rsvps?.length || 0}
          ticketCount={tickets?.length || 0}
          profileName={profile?.name || ''}
          profileEmail={profile?.email || ''}
          isAdmin={isAdmin}
        />
      </main>
      
    </div>
  )
}
