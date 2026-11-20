'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, METRO_AREAS, findMetroArea } from '@/lib/constants'
import type { Event, Profile } from '@/lib/types'
import Link from 'next/link'
import { Plus, Edit, Trash2, Calendar, MapPin, Eye, EyeOff, Clock, X, Upload, RotateCcw, MessageSquare, Users, Copy, Check, Ticket, QrCode, FileText, Crown, Tag, BarChart3, Globe, Rocket, ExternalLink, Settings } from 'lucide-react'
import { getSiteUrl, getShortId } from '@/lib/constants'
import { getEventChecklist } from '@/lib/event-checklist'
import { StatusBadge } from '@/components/EventChecklist'
import type { EventTier } from '@/lib/rsvp'

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

interface EventForm {
  title: string
  category: string
  description: string
  venue: string
  address: string
  city: string
  metro_region: string
  state: string
  zip_code: string
  date: string
  timeHour: string
  timeMinute: string
  timeAmPm: 'AM' | 'PM'
  ticket_url: string
  price: 'Free' | 'Paid'
  image_url: string
}

const defaultForm: EventForm = {
  title: '',
  category: CATEGORIES[0].key,
  description: '',
  venue: '',
  address: '',
  city: '',
  metro_region: metroOptions[0].key,
  state: '',
  zip_code: '',
  date: '',
  timeHour: '',
  timeMinute: '00',
  timeAmPm: 'PM',
  ticket_url: '',
  price: 'Free',
  image_url: '',
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

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string>('')
  const [addressLoading, setAddressLoading] = useState(false)
  const [copiedGuestLink, setCopiedGuestLink] = useState<string | null>(null)
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({})
  const [eventTiers, setEventTiers] = useState<Record<string, EventTier[]>>({})
  const [inlinePublishing, setInlinePublishing] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData || (profileData.role !== 'publisher' && profileData.role !== 'admin')) {
        router.push('/')
        return
      }

      setProfile(profileData as Profile)
      await fetchEvents(user.id)
      setLoading(false)
    }

    init()
  }, [])

  const fetchEvents = async (userId: string) => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('publisher_id', userId)
      .order('submitted_at', { ascending: false })

    if (data) {
      setEvents(data as Event[])
      // Fetch ticket counts for RSVP-enabled events
      const rsvpEventIds = data.filter((e: any) => e.rsvp_enabled).map((e: any) => e.id)
      if (rsvpEventIds.length > 0) {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('event_id')
          .in('event_id', rsvpEventIds)
        if (tickets) {
          const counts: Record<string, number> = {}
          for (const t of tickets) {
            counts[t.event_id] = (counts[t.event_id] || 0) + 1
          }
          setTicketCounts(counts)
        }
      }
      // Fetch tiers for all events (for checklist)
      const allIds = data.map((e: any) => e.id)
      if (allIds.length > 0) {
        const { data: allTiers } = await supabase
          .from('event_tiers')
          .select('*')
          .in('event_id', allIds)
        if (allTiers) {
          const tierMap: Record<string, EventTier[]> = {}
          for (const t of allTiers as EventTier[]) {
            if (!tierMap[t.event_id]) tierMap[t.event_id] = []
            tierMap[t.event_id].push(t)
          }
          setEventTiers(tierMap)
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    // Build time string
    const timeStr = form.timeHour ? `${form.timeHour}:${form.timeMinute} ${form.timeAmPm}` : ''

    let imageUrl = form.image_url

    if (posterFile) {
      const filePath = `${profile.id}/${Date.now()}-${posterFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(filePath, posterFile)

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('event-posters')
          .getPublicUrl(filePath)
        imageUrl = urlData.publicUrl
      }
    }

    const eventData = {
      title: form.title,
      category: form.category,
      description: form.description,
      venue: form.venue,
      address: form.address,
      city: form.city,
      metro_region: form.metro_region,
      state: form.state,
      zip_code: form.zip_code,
      date: form.date,
      time: timeStr,
      ticket_url: form.ticket_url,
      price: form.price,
      image_url: imageUrl,
    }

    if (editingId) {
      const { error } = await supabase
        .from('events')
        .update({ ...eventData, status: 'pending', rejection_feedback: '' })
        .eq('id', editingId)

      if (!error) {
        setEditingId(null)
        setShowForm(false)
        setForm(defaultForm)
        setPosterFile(null)
        setPosterPreview('')
        await fetchEvents(profile.id)
      }
    } else {
      const { error } = await supabase.from('events').insert({
        ...eventData,
        status: 'pending',
        publisher_id: profile.id,
        publisher_name: profile.name,
      })

      if (!error) {
        setShowForm(false)
        setForm(defaultForm)
        setPosterFile(null)
        setPosterPreview('')
        await fetchEvents(profile.id)
      }
    }

    setSubmitting(false)
  }

  const handleEdit = (event: Event) => {
    // Parse time string back to components
    let timeHour = '', timeMinute = '00', timeAmPm: 'AM' | 'PM' = 'PM'
    if (event.time) {
      const timeMatch = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (timeMatch) {
        timeHour = timeMatch[1]
        timeMinute = timeMatch[2]
        timeAmPm = timeMatch[3].toUpperCase() as 'AM' | 'PM'
      }
    }

    // Determine metro_region: use event's metro_region if available, otherwise detect from city
    const metroRegion = event.metro_region || findMetroArea(event.city)

    setForm({
      title: event.title,
      category: event.category,
      description: event.description,
      venue: event.venue,
      address: event.address || '',
      city: event.city || '',
      metro_region: metroRegion,
      state: event.state,
      zip_code: event.zip_code || '',
      date: event.date,
      timeHour,
      timeMinute,
      timeAmPm,
      ticket_url: event.ticket_url || '',
      price: event.price,
      image_url: event.image_url || '',
    })
    setPosterFile(null)
    if (event.image_url) {
      setPosterPreview(event.image_url)
    } else {
      setPosterPreview('')
    }
    setEditingId(event.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!profile) return
    await supabase.from('events').delete().eq('id', id)
    setDeleteConfirm(null)
    await fetchEvents(profile.id)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(defaultForm)
    setPosterFile(null)
    setPosterPreview('')
  }

  const handleInlinePublish = async (eventId: string) => {
    setInlinePublishing(eventId)
    try {
      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      if (res.ok && profile) {
        await fetchEvents(profile.id)
      }
    } catch { /* ignore */ }
    setInlinePublishing(null)
  }

  const handleInlineUnpublish = async (eventId: string) => {
    setInlinePublishing(eventId)
    try {
      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish' }),
      })
      if (res.ok && profile) {
        await fetchEvents(profile.id)
      }
    } catch { /* ignore */ }
    setInlinePublishing(null)
  }

  const handleDuplicate = async (eventId: string) => {
    setDuplicatingId(eventId)
    try {
      const res = await fetch(`/api/events/${eventId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.newEventId) {
        router.push(`/dashboard/event/${data.newEventId}`)
      }
    } catch { /* ignore */ }
    setDuplicatingId(null)
  }

  const totalEvents = events.length
  const publishedCount = events.filter((e) => e.status === 'published').length
  const pendingCount = events.filter((e) => e.status === 'pending').length
  const rejectedCount = events.filter((e) => e.status === 'rejected').length
  const draftCount = events.filter((e) => e.status === 'draft').length

  const getCategoryEmoji = (key: string) => {
    const cat = CATEGORIES.find((c) => c.key === key)
    return cat ? cat.emoji : ''
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      published: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#4F46E5]" />
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-[#4F46E5] transition-colors'
  const labelClass = 'block text-sm text-gray-400 mb-1.5'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
            >
              Publisher Dashboard
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Welcome back, {profile?.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/create"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-black transition-colors hover:opacity-90"
              style={{ backgroundColor: '#4F46E5' }}
            >
              <Plus size={18} />
              Create Event
            </Link>
            <button
              onClick={() => {
                setForm(defaultForm)
                setEditingId(null)
                setShowForm(true)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-gray-300 border border-[#E2E8F0] transition-colors hover:bg-white/5"
            >
              Quick Submit
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {[
            { label: 'Total Events', value: totalEvents, icon: Calendar, color: 'text-[#0F172A]' },
            { label: 'Published', value: publishedCount, icon: Eye, color: 'text-green-400' },
            { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-yellow-400' },
            { label: 'Drafts', value: draftCount, icon: FileText, color: 'text-gray-400' },
            { label: 'Rejected', value: rejectedCount, icon: X, color: 'text-red-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-[#E2E8F0] rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <stat.icon size={18} className={stat.color} />
                <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/dashboard/memberships"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border border-[#E2E8F0] hover:bg-white/5 hover:border-[#4F46E5]/30 transition-colors"
          >
            <Crown size={16} className="text-[#4F46E5]" />
            Memberships
          </Link>
          <Link
            href="/dashboard/passes"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 border border-[#E2E8F0] hover:bg-white/5 hover:border-[#4F46E5]/30 transition-colors"
          >
            <Tag size={16} className="text-[#4F46E5]" />
            Season Passes
          </Link>
        </div>

        {/* Event Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
                >
                  {editingId ? 'Edit Event' : 'Submit New Event'}
                </h2>
                <button onClick={cancelForm} className="text-gray-400 hover:text-[#0F172A]">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title */}
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                    placeholder="Event title"
                  />
                </div>

                {/* Poster Upload */}
                <div>
                  <label className={labelClass}>Event Poster</label>
                  <div
                    className="relative bg-white border border-dashed border-[#E2E8F0] hover:border-[#4F46E5]/50 rounded-lg transition-colors cursor-pointer"
                    style={{ height: '200px' }}
                    onClick={() => document.getElementById('poster-upload')?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const file = e.dataTransfer.files?.[0]
                      if (!file) return
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File size must be under 5MB.')
                        return
                      }
                      setPosterFile(file)
                      setPosterPreview(URL.createObjectURL(file))
                    }}
                  >
                    <input
                      id="poster-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          alert('File size must be under 5MB.')
                          e.target.value = ''
                          return
                        }
                        setPosterFile(file)
                        setPosterPreview(URL.createObjectURL(file))
                        e.target.value = ''
                      }}
                    />
                    {posterPreview ? (
                      <div className="relative w-full h-full">
                        <img
                          src={posterPreview}
                          alt="Poster preview"
                          className="w-full h-full object-contain rounded-lg"
                        />
                        {editingId && form.image_url && !posterFile && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-[#0F172A] text-sm font-medium">Change poster</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
                        <Upload size={28} className="text-gray-600" />
                        <p className="text-sm">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-600 text-center px-4">
                          Recommended: 1200 x 675px (16:9 ratio) or 1080 x 1080px (1:1). Max 5MB. JPG or PNG.
                        </p>
                      </div>
                    )}
                  </div>
                  {posterPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPosterFile(null)
                        setPosterPreview('')
                        setForm({ ...form, image_url: '' })
                      }}
                      className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address with auto-detect */}
                <div>
                  <label className={labelClass}>Event Address</label>
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    onBlur={async (e) => {
                      const addr = e.target.value.trim()
                      if (!addr || addr.length < 5) return
                      setAddressLoading(true)
                      const result = await geocodeAddress(addr)
                      if (result) {
                        setForm((prev) => ({
                          ...prev,
                          city: result.city || prev.city,
                          state: result.state || prev.state,
                          zip_code: result.zip_code || prev.zip_code,
                          metro_region: result.metro_region !== 'Other' ? result.metro_region : prev.metro_region,
                        }))
                      }
                      setAddressLoading(false)
                    }}
                    className={inputClass}
                    placeholder="Full address, e.g., 1234 Main St, Fremont, CA 94536"
                  />
                  {addressLoading && (
                    <p className="text-xs text-[#4F46E5] mt-1">Detecting location...</p>
                  )}
                </div>

                {/* Auto-detected location fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>City <span className="text-gray-600">(auto-detected)</span></label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      onBlur={(e) => {
                        const detected = findMetroArea(e.target.value)
                        if (detected && detected !== 'Other') {
                          setForm((prev) => ({
                            ...prev,
                            metro_region: detected,
                            ...(prev.state === '' && METRO_STATE_MAP[detected] ? { state: METRO_STATE_MAP[detected] } : {}),
                          }))
                        }
                      }}
                      className={inputClass}
                      placeholder="e.g., Fremont, Sunnyvale, Edison"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Metro Region <span className="text-gray-600">(auto-detected)</span></label>
                    <select
                      required
                      value={form.metro_region}
                      onChange={(e) => {
                        const metro = e.target.value
                        setForm((prev) => ({
                          ...prev,
                          metro_region: metro,
                          ...(prev.state === '' && METRO_STATE_MAP[metro] ? { state: METRO_STATE_MAP[metro] } : {}),
                        }))
                      }}
                      className={inputClass}
                    >
                      {metroOptions.map((metro) => (
                        <option key={metro.key} value={metro.key}>
                          {metro.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>State <span className="text-gray-600">(auto-detected)</span></label>
                    <select
                      required
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Zip Code <span className="text-gray-600">(auto-detected)</span></label>
                    <input
                      type="text"
                      required
                      value={form.zip_code}
                      onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                      className={inputClass}
                      placeholder="e.g., 94536"
                      pattern="\d{5}"
                      title="Please enter a 5-digit US zip code"
                      maxLength={5}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    required
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inputClass}
                    placeholder="Describe the event..."
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className={labelClass}>Venue</label>
                  <input
                    type="text"
                    required
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className={inputClass}
                    placeholder="Venue name and address"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Time</label>
                    <div className="flex gap-2">
                      <select
                        required
                        value={form.timeHour}
                        onChange={(e) => setForm({ ...form, timeHour: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Hr</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                          <option key={h} value={String(h)}>{h}</option>
                        ))}
                      </select>
                      <span className="text-gray-500 self-center text-lg font-bold">:</span>
                      <select
                        value={form.timeMinute}
                        onChange={(e) => setForm({ ...form, timeMinute: e.target.value })}
                        className={inputClass}
                      >
                        {['00', '15', '30', '45'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={form.timeAmPm}
                        onChange={(e) => setForm({ ...form, timeAmPm: e.target.value as 'AM' | 'PM' })}
                        className={inputClass}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ticket / Registration URL */}
                <div>
                  <label className={labelClass}>Ticket / Registration URL</label>
                  <input
                    type="text"
                    required
                    value={form.ticket_url}
                    onChange={(e) => setForm({ ...form, ticket_url: e.target.value })}
                    className={inputClass}
                    placeholder="https://www.eventbrite.com/... or registration page URL"
                  />
                  <p className="text-xs text-gray-600 mt-1">Link where attendees can register or buy tickets</p>
                </div>

                {/* Price */}
                <div>
                  <label className={labelClass}>Price</label>
                  <div className="flex gap-6 mt-1">
                    {(['Free', 'Paid'] as const).map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="price"
                          value={option}
                          checked={form.price === option}
                          onChange={() => setForm({ ...form, price: option })}
                          className="accent-[#4F46E5]"
                        />
                        <span className="text-sm text-gray-300">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-lg font-medium text-sm text-black transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#4F46E5' }}
                  >
                    {submitting
                      ? 'Saving...'
                      : editingId
                        ? 'Update Event'
                        : 'Submit for Review'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-6 py-3 rounded-lg text-sm text-gray-400 border border-[#E2E8F0] hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* My Events */}
        <div>
          <h2
            className="text-xl font-bold mb-5"
            style={{ fontFamily: 'Plus Jakarta Sans, serif' }}
          >
            My Events
          </h2>

          {events.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12">
              <div className="text-center max-w-md mx-auto">
                <div className="text-5xl mb-4">🪔</div>
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
                  Welcome to Ticvite!
                </h3>
                <p className="text-sm mb-6" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                  Create your first event and go live in minutes. Here&apos;s how it works:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>1</div>
                    <div className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>Create Event</div>
                    <div className="text-xs" style={{ color: '#475569' }}>Fill in the basics — title, date, venue, poster</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>2</div>
                    <div className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>Set Up Tickets</div>
                    <div className="text-xs" style={{ color: '#475569' }}>Free or paid, one tier or many — your choice</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>3</div>
                    <div className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>Go Live</div>
                    <div className="text-xs" style={{ color: '#475569' }}>Complete all 10 checklist items and publish</div>
                  </div>
                </div>
                <Link
                  href="/dashboard/create"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-bold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#4F46E5', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}
                >
                  <Calendar size={18} />
                  Create Your First Event
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const checklist = getEventChecklist(event, eventTiers[event.id] || [])
                const shortId = getShortId(event.id)
                const isDraft = event.status === 'draft'
                const isReady = checklist.status === 'ready'
                const isLive = event.status === 'published'

                return (
                <div
                  key={event.id}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5"
                >
                  {/* Top row: info + status */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getCategoryEmoji(event.category)}</span>
                        <h3 className="font-semibold text-[#0F172A] truncate">{event.title}</h3>
                        <StatusBadge status={checklist.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {event.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {event.city}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {event.time}
                        </span>
                      </div>
                    </div>

                    {/* Preview link for any status */}
                    <Link
                      href={`/e/${shortId}`}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-[#E2E8F0] hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink size={12} /> Preview
                    </Link>
                  </div>

                  {/* Compact checklist progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: '#475569' }}>
                        {checklist.requiredComplete}/{checklist.requiredTotal} required complete
                      </span>
                      {!checklist.ready && (
                        <span className="text-[10px] font-medium" style={{ color: '#7C3AED' }}>
                          {checklist.requiredTotal - checklist.requiredComplete} more to go live
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((checklist.requiredComplete / checklist.requiredTotal) * 100)}%`,
                          backgroundColor: checklist.ready ? '#2D7A3A' : '#4F46E5',
                        }}
                      />
                    </div>
                  </div>

                  {/* Status-based actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* DRAFT: "Complete Setup" */}
                    {isDraft && !isReady && (
                      <Link
                        href={`/dashboard/event/${event.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#7C3AED', color: '#fff' }}
                      >
                        <Settings size={12} />
                        Complete Setup
                      </Link>
                    )}

                    {/* READY: Go Live + Settings */}
                    {isReady && !isLive && (
                      <button
                        onClick={() => handleInlinePublish(event.id)}
                        disabled={inlinePublishing === event.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                      >
                        <Rocket size={12} />
                        {inlinePublishing === event.id ? 'Publishing...' : 'Go Live'}
                      </button>
                    )}

                    {/* LIVE: RSVPs, Check-In, Analytics, Unpublish */}
                    {isLive && (
                      <>
                        <Link
                          href={`/dashboard/rsvps/${event.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Users size={12} />
                          RSVPs
                        </Link>
                        <Link
                          href={`/checkin?event=${event.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                        >
                          <QrCode size={12} />
                          Check-In
                        </Link>
                        <Link
                          href={`/dashboard/analytics/${event.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-700 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                        >
                          <BarChart3 size={12} />
                          Analytics
                        </Link>
                        <button
                          onClick={() => handleInlineUnpublish(event.id)}
                          disabled={inlinePublishing === event.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-500/10 text-orange-700 border border-orange-500/20 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                        >
                          <EyeOff size={12} />
                          {inlinePublishing === event.id ? 'Unpublishing...' : 'Unpublish'}
                        </button>
                      </>
                    )}

                    {/* Settings link for all statuses */}
                    <Link
                      href={`/dashboard/event/${event.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/20 hover:bg-[#4F46E5]/20 transition-colors"
                    >
                      <Settings size={12} />
                      Settings
                    </Link>

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicate(event.id)}
                      disabled={duplicatingId === event.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-[#E2E8F0] hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <Copy size={12} />
                      {duplicatingId === event.id ? 'Duplicating...' : 'Duplicate'}
                    </button>

                    {/* Ticket count badge */}
                    {ticketCounts[event.id] > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
                        <Ticket size={12} />
                        {ticketCounts[event.id]} tickets
                      </span>
                    )}

                    {event.status === 'rejected' && (
                      <button
                        onClick={() => { handleEdit(event); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                        title="Edit and resubmit"
                      >
                        <RotateCcw size={12} />
                        Edit & Resubmit
                      </button>
                    )}

                    {(event as any).guest_edit_token && (
                      <button
                        onClick={() => {
                          const link = `${getSiteUrl()}/g/${(event as any).guest_edit_token}`
                          navigator.clipboard.writeText(link)
                          setCopiedGuestLink(event.id)
                          setTimeout(() => setCopiedGuestLink(null), 2000)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-700 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                        title="Copy guest management link"
                      >
                        {copiedGuestLink === event.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedGuestLink === event.id ? 'Copied!' : 'Guest Link'}
                      </button>
                    )}

                    <div className="flex-1" />

                    <button
                      onClick={() => handleEdit(event)}
                      className="p-2 rounded-lg text-gray-400 hover:text-[#4F46E5] hover:bg-white/5 transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>

                    {deleteConfirm === event.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-[#E2E8F0] hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(event.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Rejection feedback */}
                  {event.status === 'rejected' && event.rejection_feedback && (
                    <div className="w-full mt-3 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare size={12} className="text-red-500" />
                        <span className="text-xs font-medium text-red-500">Admin Feedback</span>
                      </div>
                      <p className="text-sm text-gray-600">{event.rejection_feedback}</p>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      
    </div>
  )
}
