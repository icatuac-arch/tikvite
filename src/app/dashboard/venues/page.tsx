'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, MapPin, Building2 } from 'lucide-react'
import type { Venue } from '@/lib/seating-types'

export default function VenuesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [venues, setVenues] = useState<Venue[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?next=/dashboard/venues'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        router.push('/')
        return
      }

      try {
        const res = await fetch('/api/venues')
        const json = await res.json()
        if (json.ok) setVenues(json.venues || [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
            >
              Venues
            </h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Manage your event venues and seating layouts.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/venues/create')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
          >
            <Plus size={16} /> Create Venue
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#7C3AED' }} />
          </div>
        ) : venues.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
          >
            <Building2 size={48} style={{ color: '#E2E8F0' }} className="mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2" style={{ color: '#334155' }}>No venues yet</h2>
            <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
              Create a venue to set up seating charts for your events.
            </p>
            <button
              onClick={() => router.push('/dashboard/venues/create')}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              <Plus size={14} className="inline mr-1" /> Create Your First Venue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="rounded-2xl p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                onClick={() => router.push(`/dashboard/venues/${venue.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="text-base font-bold"
                    style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
                  >
                    {venue.name}
                  </h3>
                  {venue.verified && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#D1FAE5', color: '#2D7A3A' }}
                    >
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
                  <MapPin size={12} />
                  <span>
                    {[venue.address, venue.city, venue.state, venue.zip_code]
                      .filter(Boolean)
                      .join(', ') || 'No address set'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      
    </div>
  )
}
