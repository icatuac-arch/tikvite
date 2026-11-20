'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, METRO_AREAS, findMetroArea } from '@/lib/constants'
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  Calendar,
  MapPin,
  Ticket,
  Eye,
  FileText,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react'

const metroOptions = METRO_AREAS.filter((m) => m.key !== 'All Cities')

const METRO_STATE_MAP: Record<string, string> = {
  'New York': 'New York', 'NJ': 'New Jersey', 'Bay Area': 'California',
  'LA': 'California', 'Chicago': 'Illinois', 'Houston': 'Texas',
  'Seattle': 'Washington', 'Dallas': 'Texas', 'Miami': 'Florida',
  'Boston': 'Massachusetts', 'DC': 'DC', 'Austin': 'Texas',
  'Atlanta': 'Georgia', 'San Antonio': 'Texas',
  'San Diego': 'California', 'Phoenix': 'Arizona', 'Detroit': 'Michigan',
  'Philadelphia': 'Pennsylvania', 'Denver': 'Colorado', 'Columbus': 'Ohio',
  'Minneapolis': 'Minnesota', 'Research Triangle': 'North Carolina',
  'Charlotte': 'North Carolina', 'Tampa': 'Florida', 'Orlando': 'Florida',
  'Pittsburgh': 'Pennsylvania', 'Cleveland': 'Ohio', 'Cincinnati': 'Ohio',
  'Indianapolis': 'Indiana', 'Milwaukee': 'Wisconsin', 'St Louis': 'Missouri',
  'Sacramento': 'California',
}

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

interface TierDraft {
  id: string
  name: string
  price: number
  capacity: string
}

async function geocodeAddress(address: string): Promise<{ city: string; state: string; zip_code: string; metro_region: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'ICATUAC-EventApp/1.0' } }
    )
    const data = await res.json()
    if (!data || data.length === 0) return null
    const addr = data[0].address
    const city = addr.city || addr.town || addr.village || addr.hamlet || ''
    const state = addr.state || ''
    const zip_code = addr.postcode?.split('-')[0] || ''
    const metro_region = findMetroArea(city) || 'Other'
    return { city, state, zip_code, metro_region }
  } catch {
    return null
  }
}

const STEP_LABELS = [
  'About Your Event',
  'When & Where',
  'Tickets',
  'Registration',
  'Review & Publish',
]

export default function CreateEventWizard() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0].key)
  const [description, setDescription] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState('')

  const [date, setDate] = useState('')
  const [timeHour, setTimeHour] = useState('')
  const [timeMinute, setTimeMinute] = useState('00')
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM')
  const [venue, setVenue] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [metroRegion, setMetroRegion] = useState<string>(metroOptions[0].key)
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [addressLoading, setAddressLoading] = useState(false)

  const [isFree, setIsFree] = useState(true)
  const [capacity, setCapacity] = useState('')
  const [tiers, setTiers] = useState<TierDraft[]>([
    { id: '1', name: 'General Admission', price: 0, capacity: '' },
  ])

  const [paymentLink, setPaymentLink] = useState('')
  const [paymentInstructions, setPaymentInstructions] = useState('')

  // Seating mode
  const [seatingMode, setSeatingMode] = useState<'ga' | 'reserved'>('ga')
  const [venueList, setVenueList] = useState<{ id: string; name: string }[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState('')
  const [layoutList, setLayoutList] = useState<{ id: string; name: string; version: number; price_zones?: string[] }[]>([])
  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [zonePrices, setZonePrices] = useState<Record<string, string>>({})
  const [venuesLoading, setVenuesLoading] = useState(false)
  const [layoutsLoading, setLayoutsLoading] = useState(false)

  // Auth check
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?next=/dashboard/create'); return }

      const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        router.push('/')
        return
      }
      setUserId(user.id)
      setUserName(profile.name || '')
      setLoading(false)
    })()
  }, [])

  const handleAddressBlur = async () => {
    const addr = address.trim()
    if (!addr || addr.length < 5) return
    setAddressLoading(true)
    const result = await geocodeAddress(addr)
    if (result) {
      if (result.city) setCity(result.city)
      if (result.state) setState(result.state)
      if (result.zip_code) setZipCode(result.zip_code)
      if (result.metro_region !== 'Other') setMetroRegion(result.metro_region)
    }
    setAddressLoading(false)
  }

  // Fetch venues when seating mode changes to reserved
  const fetchVenues = async () => {
    setVenuesLoading(true)
    try {
      const res = await fetch('/api/venues')
      const json = await res.json()
      if (json.ok) setVenueList(json.venues || [])
    } catch { /* ignore */ }
    setVenuesLoading(false)
  }

  // Fetch layouts when venue is selected
  const fetchLayouts = async (venueId: string) => {
    setLayoutsLoading(true)
    setLayoutList([])
    setSelectedLayoutId('')
    setZonePrices({})
    try {
      const res = await fetch(`/api/venues/${venueId}/layouts`)
      const json = await res.json()
      if (json.ok) setLayoutList(json.layouts || [])
    } catch { /* ignore */ }
    setLayoutsLoading(false)
  }

  // Fetch layout details to get price zones
  const fetchLayoutZones = async (venueId: string, layoutId: string) => {
    try {
      const res = await fetch(`/api/venues/${venueId}/layouts/${layoutId}`)
      const json = await res.json()
      if (json.ok && json.sections) {
        const zones = new Set<string>()
        for (const sec of json.sections) {
          if (sec.price_zone) zones.add(sec.price_zone)
        }
        const zoneMap: Record<string, string> = {}
        zones.forEach((z) => { zoneMap[z] = '' })
        setZonePrices(zoneMap)
      }
    } catch { /* ignore */ }
  }

  const addTier = () => {
    setTiers((prev) => [...prev, { id: String(Date.now()), name: '', price: 0, capacity: '' }])
  }
  const removeTier = (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id))
  }
  const updateTier = (id: string, field: keyof TierDraft, value: string | number) => {
    setTiers((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t))
  }

  // Readiness checks
  const checks = {
    title: title.trim().length > 0,
    date: date.length > 0,
    venue: venue.trim().length > 0,
    address: address.trim().length > 0,
    city: city.trim().length > 0,
    state: state.length > 0,
  }
  const allReady = Object.values(checks).every(Boolean)

  const handleSubmit = async (asDraft: boolean) => {
    if (!asDraft && !allReady) {
      setError('Please fill in all required fields before submitting.')
      return
    }
    setSubmitting(true)
    setError('')

    const timeStr = timeHour ? `${timeHour}:${timeMinute} ${timeAmPm}` : ''

    let imageUrl = ''
    if (posterFile) {
      const filePath = `${userId}/${Date.now()}-${posterFile.name}`
      const { error: uploadError } = await supabase.storage.from('event-posters').upload(filePath, posterFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('event-posters').getPublicUrl(filePath)
        imageUrl = urlData.publicUrl
      }
    }

    const hasPaidTiers = !isFree && tiers.some((t) => t.price > 0)
    const eventData: Record<string, any> = {
      title: title.trim(),
      category,
      description: description.trim(),
      venue: venue.trim(),
      address: address.trim(),
      city: city.trim(),
      metro_region: metroRegion,
      state,
      zip_code: zipCode.trim(),
      date,
      time: timeStr,
      price: isFree ? 'Free' : 'Paid',
      image_url: imageUrl,
      status: asDraft ? 'draft' : 'pending',
      publisher_id: userId,
      publisher_name: userName,
      rsvp_enabled: true,
      rsvp_capacity: capacity ? parseInt(capacity, 10) : null,
      payment_link: paymentLink.trim(),
      payment_instructions: paymentInstructions.trim(),
      seating_mode: seatingMode,
      venue_id: seatingMode === 'reserved' && selectedVenueId ? selectedVenueId : null,
      layout_id: seatingMode === 'reserved' && selectedLayoutId ? selectedLayoutId : null,
    }

    const { data: inserted, error: insErr } = await supabase.from('events').insert(eventData).select('id').single()
    if (insErr || !inserted) {
      setError(insErr?.message || 'Failed to create event')
      setSubmitting(false)
      return
    }

    // Insert tiers if paid event or if user defined tiers
    if (seatingMode === 'reserved' && Object.keys(zonePrices).length > 0) {
      // Create tiers from price zones
      const tierRows = Object.entries(zonePrices)
        .filter(([, price]) => price !== '')
        .map(([zone, price], i) => ({
          event_id: inserted.id,
          name: zone.charAt(0).toUpperCase() + zone.slice(1),
          price: parseFloat(price) || 0,
          capacity: null,
          sort_order: i,
        }))
      if (tierRows.length > 0) {
        await supabase.from('event_tiers').insert(tierRows)
      }
    } else if (hasPaidTiers || (!isFree && tiers.length > 0)) {
      const tierRows = tiers
        .filter((t) => t.name.trim())
        .map((t, i) => ({
          event_id: inserted.id,
          name: t.name.trim(),
          price: t.price || 0,
          capacity: t.capacity ? parseInt(t.capacity, 10) : null,
          sort_order: i,
        }))
      if (tierRows.length > 0) {
        await supabase.from('event_tiers').insert(tierRows)
      }
    } else if (isFree && eventData.rsvp_enabled) {
      // Free event with RSVP enabled but no tiers explicitly created —
      // auto-insert a default "General Admission" tier so the RSVP form works.
      await supabase.from('event_tiers').insert({
        event_id: inserted.id,
        name: 'General Admission',
        price: 0,
        capacity: null,
        sort_order: 0,
      })
    }

    // Initialize session seats for reserved seating events
    if (seatingMode === 'reserved' && selectedLayoutId) {
      try {
        await fetch(`/api/events/${inserted.id}/initialize-seats`, { method: 'POST' })
      } catch { /* non-blocking */ }
    }

    router.push(`/dashboard/event/${inserted.id}`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#7C3AED' }} />
        </div>
      </div>
    )
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 transition-all'
  const inputStyle = { borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#fff' }
  const labelClass = 'block text-sm font-medium mb-1.5'
  const labelStyle = { color: '#475569', fontFamily: 'Inter, sans-serif' }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
        >
          Create Event
        </h1>
        <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
          Follow the steps to set up your event.
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => setStep(i)}
                className="flex flex-col items-center"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    backgroundColor: i <= step ? '#4F46E5' : '#E2E8F0',
                    color: i <= step ? '#F8FAFC' : '#94A3B8',
                  }}
                >
                  {i < step ? <Check size={16} /> : i + 1}
                </div>
                <span
                  className="text-[10px] mt-1 hidden sm:block text-center max-w-[80px]"
                  style={{ color: i <= step ? '#4F46E5' : '#94A3B8' }}
                >
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-1 sm:mx-2"
                  style={{ backgroundColor: i < step ? '#4F46E5' : '#E2E8F0', minWidth: 16 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
        >
          {/* Step 1: About */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                Tell us about your event
              </h2>

              <div>
                <label className={labelClass} style={labelStyle}>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="e.g., Diwali Mela 2026"
                />
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Describe what attendees can expect..."
                />
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Event Poster</label>
                <div
                  className="relative border-2 border-dashed rounded-xl transition-colors cursor-pointer hover:border-[#7C3AED]/50"
                  style={{ borderColor: '#E2E8F0', height: 200 }}
                  onClick={() => document.getElementById('wizard-poster')?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation()
                    const file = e.dataTransfer.files?.[0]
                    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return
                    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return }
                    setPosterFile(file)
                    setPosterPreview(URL.createObjectURL(file))
                  }}
                >
                  <input
                    id="wizard-poster"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); e.target.value = ''; return }
                      setPosterFile(file)
                      setPosterPreview(URL.createObjectURL(file))
                      e.target.value = ''
                    }}
                  />
                  {posterPreview ? (
                    <img src={posterPreview} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#94A3B8' }}>
                      <Upload size={28} />
                      <p className="text-sm">Click or drag to upload</p>
                      <p className="text-xs">JPG, PNG, WebP. Max 5MB.</p>
                    </div>
                  )}
                </div>
                {posterPreview && (
                  <button
                    type="button"
                    onClick={() => { setPosterFile(null); setPosterPreview('') }}
                    className="mt-2 flex items-center gap-1 text-xs hover:opacity-70"
                    style={{ color: '#C62828' }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: When & Where */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                When and where?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Date *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Time</label>
                  <div className="flex gap-2">
                    <select value={timeHour} onChange={(e) => setTimeHour(e.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">Hr</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={String(h)}>{h}</option>
                      ))}
                    </select>
                    <span className="self-center font-bold" style={{ color: '#94A3B8' }}>:</span>
                    <select value={timeMinute} onChange={(e) => setTimeMinute(e.target.value)} className={inputClass} style={inputStyle}>
                      {['00', '15', '30', '45'].map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <select value={timeAmPm} onChange={(e) => setTimeAmPm(e.target.value as 'AM' | 'PM')} className={inputClass} style={inputStyle}>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Venue Name *</label>
                <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g., Hindu Temple Community Hall" />
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={handleAddressBlur}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Full address, e.g., 1234 Main St, Fremont, CA 94536"
                />
                {addressLoading && <p className="text-xs mt-1" style={{ color: '#7C3AED' }}>Detecting location...</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Metro Region</label>
                  <select
                    value={metroRegion}
                    onChange={(e) => {
                      setMetroRegion(e.target.value)
                      if (!state && METRO_STATE_MAP[e.target.value]) setState(METRO_STATE_MAP[e.target.value])
                    }}
                    className={inputClass}
                    style={inputStyle}
                  >
                    {metroOptions.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>State *</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass} style={inputStyle}>
                    <option value="">Select state</option>
                    {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Zip Code</label>
                  <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g., 94536" maxLength={5} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Tickets */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                How will tickets work?
              </h2>

              {/* Seating Mode Toggle */}
              <div>
                <label className={labelClass} style={labelStyle}>Seating Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSeatingMode('ga')}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                    style={{
                      borderColor: seatingMode === 'ga' ? '#7C3AED' : '#E2E8F0',
                      backgroundColor: seatingMode === 'ga' ? '#FFF3E0' : '#fff',
                      color: seatingMode === 'ga' ? '#7C3AED' : '#475569',
                    }}
                  >
                    General Admission
                  </button>
                  <button
                    onClick={() => {
                      setSeatingMode('reserved')
                      if (venueList.length === 0) fetchVenues()
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                    style={{
                      borderColor: seatingMode === 'reserved' ? '#7C3AED' : '#E2E8F0',
                      backgroundColor: seatingMode === 'reserved' ? '#FFF3E0' : '#fff',
                      color: seatingMode === 'reserved' ? '#7C3AED' : '#475569',
                    }}
                  >
                    Reserved Seating
                  </button>
                </div>
              </div>

              {/* Reserved Seating: Venue + Layout selection */}
              {seatingMode === 'reserved' && (
                <div className="space-y-4 p-4 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div>
                    <label className={labelClass} style={labelStyle}>Venue *</label>
                    {venuesLoading ? (
                      <p className="text-xs" style={{ color: '#7C3AED' }}>Loading venues...</p>
                    ) : (
                      <select
                        value={selectedVenueId}
                        onChange={(e) => {
                          setSelectedVenueId(e.target.value)
                          if (e.target.value) fetchLayouts(e.target.value)
                        }}
                        className={inputClass}
                        style={inputStyle}
                      >
                        <option value="">Select a venue</option>
                        {venueList.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedVenueId && (
                    <div>
                      <label className={labelClass} style={labelStyle}>Layout *</label>
                      {layoutsLoading ? (
                        <p className="text-xs" style={{ color: '#7C3AED' }}>Loading layouts...</p>
                      ) : layoutList.length === 0 ? (
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          No layouts found. Create one in the venue editor first.
                        </p>
                      ) : (
                        <select
                          value={selectedLayoutId}
                          onChange={(e) => {
                            setSelectedLayoutId(e.target.value)
                            if (e.target.value && selectedVenueId) {
                              fetchLayoutZones(selectedVenueId, e.target.value)
                            }
                          }}
                          className={inputClass}
                          style={inputStyle}
                        >
                          <option value="">Select a layout</option>
                          {layoutList.map((l) => (
                            <option key={l.id} value={l.id}>{l.name} (v{l.version})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Price zone mapping */}
                  {selectedLayoutId && Object.keys(zonePrices).length > 0 && (
                    <div>
                      <label className={labelClass} style={labelStyle}>Price Zones</label>
                      <div className="space-y-2">
                        {Object.entries(zonePrices).map(([zone, price]) => (
                          <div key={zone} className="flex items-center gap-3">
                            <span
                              className="text-sm font-medium w-28 capitalize"
                              style={{ color: '#334155' }}
                            >
                              {zone}
                            </span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94A3B8' }}>$</span>
                              <input
                                type="number"
                                value={price}
                                onChange={(e) => setZonePrices((prev) => ({ ...prev, [zone]: e.target.value }))}
                                className={inputClass}
                                style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                                placeholder="0.00"
                                min={0}
                                step={0.01}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setIsFree(true)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{
                    borderColor: isFree ? '#4F46E5' : '#E2E8F0',
                    backgroundColor: isFree ? '#4F46E5' : '#fff',
                    color: isFree ? '#F8FAFC' : '#475569',
                  }}
                >
                  Free Event
                </button>
                <button
                  onClick={() => setIsFree(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{
                    borderColor: !isFree ? '#4F46E5' : '#E2E8F0',
                    backgroundColor: !isFree ? '#4F46E5' : '#fff',
                    color: !isFree ? '#F8FAFC' : '#475569',
                  }}
                >
                  Paid Event
                </button>
              </div>

              {seatingMode !== 'reserved' && (
              <div>
                <label className={labelClass} style={labelStyle}>
                  {isFree ? 'Capacity (optional)' : 'Overall Capacity (optional)'}
                </label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Leave blank for unlimited"
                  min={1}
                />
              </div>
              )}

              {!isFree && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium" style={{ color: '#475569' }}>Ticket Tiers</label>
                    <button
                      onClick={addTier}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                    >
                      <Plus size={14} /> Add Tier
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                      >
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                            placeholder="Tier name"
                            className="col-span-3 sm:col-span-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#E2E8F0', color: '#334155' }}
                          />
                          <input
                            type="number"
                            value={tier.price || ''}
                            onChange={(e) => updateTier(tier.id, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="Price ($)"
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#E2E8F0', color: '#334155' }}
                            min={0}
                            step={0.01}
                          />
                          <input
                            type="number"
                            value={tier.capacity}
                            onChange={(e) => updateTier(tier.id, 'capacity', e.target.value)}
                            placeholder="Capacity"
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#E2E8F0', color: '#334155' }}
                            min={1}
                          />
                        </div>
                        {tiers.length > 1 && (
                          <button
                            onClick={() => removeTier(tier.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                            style={{ color: '#C62828' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Registration & Payment */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                Registration & Payment
              </h2>

              {isFree ? (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ backgroundColor: '#D1FAE5', border: '1px solid #D1FAE5' }}
                >
                  <Check size={20} style={{ color: '#2E7D32' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#2E7D32' }}>Free event — no payment needed</p>
                    <p className="text-xs mt-0.5" style={{ color: '#4CAF50' }}>Attendees register with their name and email.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelClass} style={labelStyle}>Payment Link</label>
                    <input
                      type="url"
                      value={paymentLink}
                      onChange={(e) => setPaymentLink(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="e.g., https://venmo.com/yourname or PayPal.me link"
                    />
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Where attendees should send payment</p>
                  </div>

                  <div>
                    <label className={labelClass} style={labelStyle}>Payment Instructions</label>
                    <textarea
                      rows={3}
                      value={paymentInstructions}
                      onChange={(e) => setPaymentInstructions(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="e.g., Please include your name and 'Diwali Mela' in the payment note."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Review & Publish */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                Review & Publish
              </h2>

              {/* Preview card */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid #E2E8F0' }}
              >
                {posterPreview && (
                  <img src={posterPreview} alt="Preview" className="w-full h-44 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>
                      {CATEGORIES.find((c) => c.key === category)?.emoji} {CATEGORIES.find((c) => c.key === category)?.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: isFree ? '#D1FAE5' : '#FFF3E0', color: isFree ? '#2E7D32' : '#7C3AED' }}>
                      {isFree ? 'Free' : 'Paid'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}>
                    {title || 'Untitled Event'}
                  </h3>
                  {date && (
                    <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: '#475569' }}>
                      <Calendar size={12} /> {date}{timeHour ? ` at ${timeHour}:${timeMinute} ${timeAmPm}` : ''}
                    </div>
                  )}
                  {venue && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
                      <MapPin size={12} /> {venue}{city ? `, ${city}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Readiness checklist */}
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#475569' }}>Readiness Checklist</p>
                {[
                  { label: 'Title set', ok: checks.title },
                  { label: 'Date set', ok: checks.date },
                  { label: 'Venue set', ok: checks.venue },
                  { label: 'Address set', ok: checks.address },
                  { label: 'City set', ok: checks.city },
                  { label: 'State set', ok: checks.state },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.ok ? (
                      <Check size={16} style={{ color: '#2E7D32' }} />
                    ) : (
                      <AlertCircle size={16} style={{ color: '#7C3AED' }} />
                    )}
                    <span className="text-sm" style={{ color: item.ok ? '#2E7D32' : '#7C3AED' }}>{item.label}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#C62828' }}>
                  <AlertCircle size={16} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: '#E2E8F0', color: '#475569' }}
                >
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !allReady}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 4 && (
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-30"
              style={{ color: '#4F46E5' }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      
    </div>
  )
}
