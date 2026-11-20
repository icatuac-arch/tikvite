'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, AlertCircle } from 'lucide-react'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'DC', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana',
  'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
  'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
]

export default function CreateVenuePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?next=/dashboard/venues/create'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        router.push('/')
        return
      }
      setLoading(false)
    })()
  }, [])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Venue name is required'); return }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state,
        }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error || 'Failed to create venue'); setSubmitting(false); return }
      router.push('/dashboard/venues')
    } catch {
      setError('Network error')
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 transition-all'
  const inputStyle = { borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#fff' }
  const labelClass = 'block text-sm font-medium mb-1.5'
  const labelStyle = { color: '#475569', fontFamily: 'Inter, sans-serif' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#7C3AED' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/dashboard/venues')}
          className="flex items-center gap-1 text-sm font-medium mb-6 hover:opacity-70 transition-opacity"
          style={{ color: '#4F46E5' }}
        >
          <ChevronLeft size={16} /> Back to Venues
        </button>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
        >
          Create Venue
        </h1>
        <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
          Add a new venue to use with your events.
        </p>

        <div
          className="rounded-2xl p-6 sm:p-8 space-y-5"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
        >
          <div>
            <label className={labelClass} style={labelStyle}>Venue Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="e.g., Hindu Temple Community Hall"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="e.g., 1234 Main St"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="e.g., Fremont"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#C62828' }}>
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
          >
            {submitting ? 'Creating...' : 'Create Venue'}
          </button>
        </div>
      </main>

      
    </div>
  )
}
