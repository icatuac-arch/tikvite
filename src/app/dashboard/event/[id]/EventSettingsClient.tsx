'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EventChecklist, { StatusBadge } from '@/components/EventChecklist'
import SetupGuide from '@/components/SetupGuide'
import type { ChecklistItem } from '@/lib/event-checklist'
import type { Event } from '@/lib/types'
import type { EventTier } from '@/lib/rsvp'
import { CATEGORIES, METRO_AREAS, findMetroArea, getShortId } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import {
  Rocket, ArrowLeft, ExternalLink, Upload, Trash2, Eye, EyeOff,
  Calendar, MapPin, Clock, Tag, Users, QrCode, BarChart3, Save,
  Send, ClipboardCheck, Share2, Check, Mail, Copy, AlertTriangle,
  Printer, XCircle, Bell, Repeat, Code2, Ticket,
} from 'lucide-react'
import EmailTemplateEditor from '@/components/EmailTemplateEditor'
import TeamManager from '@/components/TeamManager'
import EventUpdates from '@/components/EventUpdates'

const metroOptions = METRO_AREAS.filter((m) => m.key !== 'All Cities')

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

async function geocodeAddress(address: string): Promise<{ city: string; state: string; zip_code: string; metro_region: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'ICATUAC-EventApp/1.0' } }
    )
    const data = await res.json()
    if (!data || data.length === 0) return null
    const addr = data[0].address
    return {
      city: addr.city || addr.town || addr.village || addr.hamlet || '',
      state: addr.state || '',
      zip_code: addr.postcode?.split('-')[0] || '',
      metro_region: findMetroArea(addr.city || addr.town || '') || 'Other',
    }
  } catch { return null }
}

interface Props {
  event: Event
  tiers: EventTier[]
  checklist: {
    items: ChecklistItem[]
    complete: number
    total: number
    ready: boolean
    status: 'draft' | 'ready' | 'live'
  }
  rsvpCount: number
  ticketCount: number
  profileName: string
  profileEmail: string
  isAdmin: boolean
}

function EmbedCodeBlock({ shortId }: { shortId: string }) {
  const [copied, setCopied] = useState(false)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ticvite.com'
  const embedCode = `<iframe src="${siteUrl}/embed/${shortId}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-xl p-4 text-xs font-mono break-all"
        style={{ backgroundColor: '#0F172A', color: '#E2E8F0' }}
      >
        <code>{embedCode}</code>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
          style={{
            borderColor: copied ? '#D1FAE5' : '#E2E8F0',
            backgroundColor: copied ? '#D1FAE5' : '#F8FAFC',
            color: copied ? '#2E7D32' : '#4F46E5',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Embed Code'}
        </button>
        <a
          href={`${siteUrl}/embed/${shortId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
        >
          <ExternalLink size={14} /> Preview Widget
        </a>
      </div>
      <p className="text-xs" style={{ color: '#94A3B8' }}>
        Paste this code into your website&apos;s HTML where you want the ticket form to appear. The widget will automatically match the width of its container.
      </p>
    </div>
  )
}

function QuickActionsBar({ eventId, rsvpCount, shortId }: { eventId: string; rsvpCount: number; shortId: string }) {
  const [copied, setCopied] = useState(false)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ticvite.com'
  const eventUrl = `${siteUrl}/e/${shortId}`

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const actions = [
    { href: `/dashboard/rsvps/${eventId}`, icon: Users, label: `Attendees (${rsvpCount})`, bg: '#F1F8E9', border: '#D1FAE5', color: '#2E7D32' },
    { href: `/dashboard/rsvps/${eventId}`, icon: Send, label: 'Send Update', bg: '#FFF3E0', border: '#FEF3C7', color: '#E65100' },
    { href: `/checkin?event=${eventId}`, icon: QrCode, label: 'Check-in Scanner', bg: '#F3E5F5', border: '#E1BEE7', color: '#7B1FA2' },
    { href: `/dashboard/event-day/${eventId}`, icon: ClipboardCheck, label: 'Event Day', bg: '#E8EAF6', border: '#C5CAE9', color: '#283593' },
    { href: `/dashboard/analytics/${eventId}`, icon: BarChart3, label: 'Analytics', bg: '#E3F2FD', border: '#BBDEFB', color: '#1565C0' },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
          style={{ borderColor: a.border, backgroundColor: a.bg, color: a.color }}
        >
          <a.icon size={14} /> {a.label}
        </Link>
      ))}
      <button
        onClick={() => window.open(`/api/events/${eventId}/checkin-list`, '_blank')}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
        style={{ borderColor: '#D7CCC8', backgroundColor: '#EFEBE9', color: '#4E342E' }}
      >
        <Printer size={14} /> Print Check-in List
      </button>
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
        style={{ borderColor: '#E0E0E0', backgroundColor: '#F5F5F5', color: '#424242' }}
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? 'Link Copied!' : 'Share Event'}
      </button>
    </div>
  )
}

export default function EventSettingsClient({
  event: initialEvent,
  tiers,
  checklist: initialChecklist,
  rsvpCount,
  ticketCount,
  profileName,
  profileEmail,
  isAdmin,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Local form state
  const [title, setTitle] = useState(initialEvent.title || '')
  const [category, setCategory] = useState(initialEvent.category || '')
  const [description, setDescription] = useState(initialEvent.description || '')
  const [date, setDate] = useState(initialEvent.date || '')
  const [timeStr, setTimeStr] = useState(initialEvent.time || '')
  const [venue, setVenue] = useState(initialEvent.venue || '')
  const [address, setAddress] = useState(initialEvent.address || '')
  const [city, setCity] = useState(initialEvent.city || '')
  const [state, setState] = useState(initialEvent.state || '')
  const [metroRegion, setMetroRegion] = useState(initialEvent.metro_region || '')
  const [ticketUrl, setTicketUrl] = useState(initialEvent.ticket_url || '')
  const [imageUrl, setImageUrl] = useState(initialEvent.image_url || '')
  const [publisherName, setPublisherName] = useState(initialEvent.publisher_name || profileName)
  const [eventStatus, setEventStatus] = useState(initialEvent.status)
  const [emailTemplates, setEmailTemplates] = useState<Record<string, string>>(
    (initialEvent as any).email_templates || {}
  )

  // Time parsing
  const parseTime = (t: string) => {
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (m) return { hour: m[1], minute: m[2], ampm: m[3].toUpperCase() as 'AM' | 'PM' }
    return { hour: '', minute: '00', ampm: 'PM' as const }
  }
  const parsed = parseTime(timeStr)
  const [timeHour, setTimeHour] = useState(parsed.hour)
  const [timeMinute, setTimeMinute] = useState(parsed.minute)
  const [timeAmPm, setTimeAmPm] = useState(parsed.ampm)

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [posterUploading, setPosterUploading] = useState(false)
  const [addressLoading, setAddressLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<string | null>(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const [recurFrequency, setRecurFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurCount, setRecurCount] = useState(4)
  const [recurringSubmitting, setRecurringSubmitting] = useState(false)
  const [recurringResult, setRecurringResult] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if first visit for setup guide
  useEffect(() => {
    const key = `setup-guide-seen-${initialEvent.id}`
    if (!localStorage.getItem(key) && initialEvent.status !== 'published') {
      setShowGuide(true)
    }
  }, [initialEvent.id, initialEvent.status])

  const dismissGuide = () => {
    setShowGuide(false)
    localStorage.setItem(`setup-guide-seen-${initialEvent.id}`, '1')
  }

  // Build computed time string
  const buildTimeStr = useCallback((h: string, m: string, ap: string) => {
    if (!h) return ''
    return `${h}:${m} ${ap}`
  }, [])

  // Debounced auto-save
  const saveFields = useCallback(async (fields: Record<string, any>) => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [initialEvent.id])

  const scheduleAutoSave = useCallback((fields: Record<string, any>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveFields(fields), 2000)
  }, [saveFields])

  // Field change handler with auto-save
  const updateField = (field: string, value: string) => {
    const fieldMap: Record<string, any> = {
      title, category, description, date, venue, address, city, state,
      metro_region: metroRegion, ticket_url: ticketUrl, image_url: imageUrl,
      publisher_name: publisherName,
    }
    fieldMap[field] = value
    // Build time if time fields changed
    if (['timeHour', 'timeMinute', 'timeAmPm'].includes(field)) {
      const h = field === 'timeHour' ? value : timeHour
      const m = field === 'timeMinute' ? value : timeMinute
      const a = field === 'timeAmPm' ? value : timeAmPm
      fieldMap.time = buildTimeStr(h, m, a)
    } else {
      fieldMap.time = buildTimeStr(timeHour, timeMinute, timeAmPm)
    }
    scheduleAutoSave(fieldMap)
  }

  // Scroll to section
  const scrollToSection = (section: string) => {
    const el = document.getElementById(section)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Poster upload
  const handlePosterUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('File size must be under 5MB.'); return }
    setPosterUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const filePath = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('event-posters').upload(filePath, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('event-posters').getPublicUrl(filePath)
      setImageUrl(urlData.publicUrl)
      await saveFields({ image_url: urlData.publicUrl })
    }
    setPosterUploading(false)
  }

  // Publish / unpublish
  const handlePublish = async () => {
    setPublishing(true)
    setPublishError('')
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPublishError(data.message || 'Cannot publish yet')
      } else {
        setEventStatus('published')
        router.refresh()
      }
    } catch {
      setPublishError('Network error')
    }
    setPublishing(false)
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish' }),
      })
      if (res.ok) {
        setEventStatus('draft')
        router.refresh()
      }
    } catch { /* ignore */ }
    setPublishing(false)
  }

  // Duplicate event
  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.newEventId) {
        router.push(`/dashboard/event/${data.newEventId}`)
      }
    } catch { /* ignore */ }
    setDuplicating(false)
  }

  // Create recurring series
  const handleCreateSeries = async () => {
    setRecurringSubmitting(true)
    setRecurringResult(null)
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: recurFrequency, count: recurCount }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setRecurringResult(`Created ${data.created} recurring event(s)!`)
        setShowRecurring(false)
        setTimeout(() => router.push('/dashboard'), 1500)
      } else {
        setRecurringResult(data.message || 'Failed to create series')
      }
    } catch {
      setRecurringResult('Network error')
    }
    setRecurringSubmitting(false)
  }

  // Cancel event
  const handleCancelEvent = async () => {
    setCancelling(true)
    setCancelResult(null)
    try {
      const res = await fetch(`/api/events/${initialEvent.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        setCancelResult(`Event cancelled. ${data.notified || 0} attendee(s) notified.`)
        setEventStatus('rejected')
        setShowCancelConfirm(false)
        router.refresh()
      } else {
        setCancelResult(data.message || 'Failed to cancel event')
      }
    } catch {
      setCancelResult('Network error')
    }
    setCancelling(false)
  }

  // Download check-in list PDF
  const handleDownloadCheckinList = () => {
    window.open(`/api/events/${initialEvent.id}/checkin-list`, '_blank')
  }

  // Address geocode on blur
  const handleAddressBlur = async () => {
    const addr = address.trim()
    if (!addr || addr.length < 5) return
    setAddressLoading(true)
    const result = await geocodeAddress(addr)
    if (result) {
      if (result.city) setCity(result.city)
      if (result.state) setState(result.state)
      if (result.metro_region !== 'Other') setMetroRegion(result.metro_region)
      scheduleAutoSave({
        address: addr,
        city: result.city || city,
        state: result.state || state,
        metro_region: result.metro_region !== 'Other' ? result.metro_region : metroRegion,
      })
    }
    setAddressLoading(false)
  }

  // Recompute checklist client-side for UI
  const currentEvent = {
    ...initialEvent,
    title, category, description, date, time: buildTimeStr(timeHour, timeMinute, timeAmPm),
    venue, address, city, state, metro_region: metroRegion,
    ticket_url: ticketUrl, image_url: imageUrl, publisher_name: publisherName,
    status: eventStatus,
  } as Event

  // Simple client-side checklist re-computation
  const items: ChecklistItem[] = [
    { key: 'title', label: 'Event title (3+ chars)', complete: !!(title.trim() && title.trim().length >= 3), required: true, section: 'details', fixLabel: 'Add title' },
    { key: 'date', label: 'Event date', complete: !!date, required: true, section: 'datetime', fixLabel: 'Set date' },
    { key: 'time', label: 'Event time', complete: !!buildTimeStr(timeHour, timeMinute, timeAmPm).trim(), required: true, section: 'datetime', fixLabel: 'Set time' },
    { key: 'venue', label: 'Venue / Location', complete: !!venue.trim(), required: true, section: 'location', fixLabel: 'Add venue' },
    { key: 'city', label: 'City & State', complete: !!(city.trim() && state.trim()), required: true, section: 'location', fixLabel: 'Set location' },
    { key: 'category', label: 'Category', complete: !!category, required: true, section: 'details', fixLabel: 'Choose category' },
    { key: 'description', label: 'Description (20+ chars)', complete: !!(description.trim() && description.trim().length > 20), required: true, section: 'details', fixLabel: 'Add description' },
    { key: 'metro', label: 'Metro region', complete: !!(metroRegion.trim() && metroRegion !== 'Other'), required: true, section: 'location', fixLabel: 'Set metro region' },
    { key: 'poster', label: 'Event poster', complete: !!imageUrl, required: true, section: 'poster', fixLabel: 'Upload poster' },
    { key: 'tickets', label: 'Ticket setup', complete: !!(ticketUrl.trim() || (initialEvent as any).rsvp_enabled), required: true, section: 'tickets', fixLabel: 'Configure tickets' },
  ]

  const completeCount = items.filter(i => i.complete).length
  const requiredItems = items.filter(i => i.required)
  const requiredCompleteCount = requiredItems.filter(i => i.complete).length
  const requiredReady = requiredItems.every(i => i.complete)
  let computedStatus: 'draft' | 'ready' | 'live' = 'draft'
  if (eventStatus === 'published') computedStatus = 'live'
  else if (requiredReady) computedStatus = 'ready'

  const shortId = getShortId(initialEvent.id)
  const isLive = eventStatus === 'published'

  const inputClass = 'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 transition-all'
  const inputStyle = { borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#fff' }
  const labelClass = 'block text-sm font-medium mb-1.5'
  const labelStyle = { color: '#475569' }
  const sectionCardClass = 'bg-white rounded-2xl border p-6 sm:p-8 scroll-mt-24'
  const sectionCardStyle = { borderColor: '#E2E8F0' }
  const sectionHeadClass = 'text-lg font-bold mb-5'
  const sectionHeadStyle = { fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }

  return (
    <div className="space-y-6 relative">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            style={{ color: '#4F46E5' }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
            >
              Event Settings
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
              {title || 'Untitled Event'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Save indicator */}
          {saveStatus === 'saving' && (
            <span className="text-xs font-medium" style={{ color: '#7C3AED' }}>Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: '#2E7D32' }}>
              <Save size={12} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs font-medium text-red-600">Save failed</span>
          )}

          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: '#E2E8F0', color: '#475569' }}
          >
            <Copy size={14} /> {duplicating ? 'Duplicating...' : 'Duplicate'}
          </button>

          {/* Repeat Event */}
          <button
            onClick={() => setShowRecurring(!showRecurring)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: '#E2E8F0', color: '#475569' }}
          >
            <Repeat size={14} /> Repeat
          </button>

          {/* Preview */}
          <Link
            href={`/e/${shortId}`}
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: '#E2E8F0', color: '#475569' }}
          >
            <ExternalLink size={14} /> Preview
          </Link>

          {/* Go Live / Unpublish */}
          {isLive ? (
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: '#E2E8F0', color: '#475569' }}
            >
              <EyeOff size={14} /> Unpublish
            </button>
          ) : (
            <div className="relative group">
              <button
                onClick={handlePublish}
                disabled={publishing || !requiredReady}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                <Rocket size={16} />
                {publishing ? 'Publishing...' : 'Go Live'}
              </button>
              {!requiredReady && !publishing && (
                <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg shadow-lg border text-xs z-50 hidden group-hover:block" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                  <div className="font-semibold mb-1.5" style={{ color: '#4F46E5' }}>Complete these to go live:</div>
                  <ul className="space-y-1" style={{ color: '#334155' }}>
                    {items.filter(i => i.required && !i.complete).map(i => (
                      <li key={i.key} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#7C3AED' }} />
                        {i.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {publishError && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#C62828' }}>
          {publishError}
        </div>
      )}

      {/* Recurring Event Form */}
      {showRecurring && (
        <div className="rounded-2xl border p-6" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
            <Repeat size={18} /> Create Recurring Series
          </h3>
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            Clone this event with incremented dates. Each copy starts as a draft.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Frequency</label>
              <select
                value={recurFrequency}
                onChange={(e) => setRecurFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                className={inputClass}
                style={inputStyle}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Number of events</label>
              <input
                type="number"
                min={1}
                max={52}
                value={recurCount}
                onChange={(e) => setRecurCount(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCreateSeries}
                disabled={recurringSubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                <Calendar size={14} />
                {recurringSubmitting ? 'Creating...' : 'Create Series'}
              </button>
              <button
                onClick={() => setShowRecurring(false)}
                className="px-3 py-3 rounded-xl text-sm font-medium border transition-colors hover:opacity-80"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}
              >
                Cancel
              </button>
            </div>
          </div>
          {recurringResult && (
            <div
              className="px-4 py-3 rounded-lg text-sm"
              style={{
                backgroundColor: recurringResult.includes('Created') ? '#D1FAE5' : '#FEE2E2',
                color: recurringResult.includes('Created') ? '#2E7D32' : '#C62828',
              }}
            >
              {recurringResult}
            </div>
          )}
        </div>
      )}

      {/* Quick actions for live events */}
      {isLive && (
        <QuickActionsBar eventId={initialEvent.id} rsvpCount={rsvpCount} shortId={shortId} />
      )}

      {/* Checklist */}
      <div className={sectionCardClass} style={sectionCardStyle}>
        <EventChecklist
          items={items}
          complete={completeCount}
          total={items.length}
          requiredComplete={requiredCompleteCount}
          requiredTotal={requiredItems.length}
          ready={requiredReady}
          status={computedStatus}
          onItemClick={scrollToSection}
        />
      </div>

      {/* Section: Details */}
      <div id="details" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Event Details</h2>
        <div className="space-y-5">
          <div>
            <label className={labelClass} style={labelStyle}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); updateField('title', e.target.value) }}
              className={inputClass}
              style={inputStyle}
              placeholder="Event title"
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Category *</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); updateField('category', e.target.value) }}
              className={inputClass}
              style={inputStyle}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Description *</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => { setDescription(e.target.value); updateField('description', e.target.value) }}
              className={inputClass}
              style={inputStyle}
              placeholder="Describe your event in detail..."
            />
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {description.trim().length}/10 characters minimum
            </p>
          </div>
        </div>
      </div>

      {/* Section: Date & Time */}
      <div id="datetime" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Date & Time</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass} style={labelStyle}>Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); updateField('date', e.target.value) }}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Time *</label>
            <div className="flex gap-2">
              <select
                value={timeHour}
                onChange={(e) => { setTimeHour(e.target.value); updateField('timeHour', e.target.value) }}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Hr</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={String(h)}>{h}</option>
                ))}
              </select>
              <span className="self-center font-bold" style={{ color: '#94A3B8' }}>:</span>
              <select
                value={timeMinute}
                onChange={(e) => { setTimeMinute(e.target.value); updateField('timeMinute', e.target.value) }}
                className={inputClass}
                style={inputStyle}
              >
                {['00', '15', '30', '45'].map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
              <select
                value={timeAmPm}
                onChange={(e) => { setTimeAmPm(e.target.value as 'AM' | 'PM'); updateField('timeAmPm', e.target.value) }}
                className={inputClass}
                style={inputStyle}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Location */}
      <div id="location" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Location</h2>
        <div className="space-y-5">
          <div>
            <label className={labelClass} style={labelStyle}>Venue Name *</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => { setVenue(e.target.value); updateField('venue', e.target.value) }}
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
              onChange={(e) => { setAddress(e.target.value); updateField('address', e.target.value) }}
              onBlur={handleAddressBlur}
              className={inputClass}
              style={inputStyle}
              placeholder="Full address"
            />
            {addressLoading && <p className="text-xs mt-1" style={{ color: '#7C3AED' }}>Detecting location...</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  updateField('city', e.target.value)
                  const detected = findMetroArea(e.target.value)
                  if (detected && detected !== 'Other') setMetroRegion(detected)
                }}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>State *</label>
              <select
                value={state}
                onChange={(e) => { setState(e.target.value); updateField('state', e.target.value) }}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Metro Region</label>
            <select
              value={metroRegion}
              onChange={(e) => {
                setMetroRegion(e.target.value)
                updateField('metro_region', e.target.value)
                if (!state && METRO_STATE_MAP[e.target.value]) setState(METRO_STATE_MAP[e.target.value])
              }}
              className={inputClass}
              style={inputStyle}
            >
              {metroOptions.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Poster */}
      <div id="poster" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Event Poster</h2>
        <div
          className="relative border-2 border-dashed rounded-xl transition-colors cursor-pointer hover:border-[#7C3AED]/50"
          style={{ borderColor: '#E2E8F0', height: 220 }}
          onClick={() => document.getElementById('settings-poster')?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation()
            const file = e.dataTransfer.files?.[0]
            if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return
            handlePosterUpload(file)
          }}
        >
          <input
            id="settings-poster"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              handlePosterUpload(file)
              e.target.value = ''
            }}
          />
          {posterUploading ? (
            <div className="flex items-center justify-center h-full" style={{ color: '#7C3AED' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-current" />
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Poster" className="w-full h-full object-contain rounded-xl" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#94A3B8' }}>
              <Upload size={28} />
              <p className="text-sm">Click or drag to upload</p>
              <p className="text-xs">JPG, PNG, WebP. Max 5MB.</p>
            </div>
          )}
        </div>
        {imageUrl && (
          <button
            onClick={async () => {
              setImageUrl('')
              await saveFields({ image_url: '' })
            }}
            className="mt-3 flex items-center gap-1 text-xs hover:opacity-70"
            style={{ color: '#C62828' }}
          >
            <Trash2 size={12} /> Remove poster
          </button>
        )}
      </div>

      {/* Section: Tickets */}
      <div id="tickets" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Ticket Setup</h2>
        <div className="space-y-5">
          <div>
            <label className={labelClass} style={labelStyle}>External Ticket / Registration URL</label>
            <input
              type="url"
              value={ticketUrl}
              onChange={(e) => { setTicketUrl(e.target.value); updateField('ticket_url', e.target.value) }}
              className={inputClass}
              style={inputStyle}
              placeholder="https://www.eventbrite.com/... or registration page URL"
            />
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              Link where attendees can register or buy tickets externally
            </p>
          </div>

          {(initialEvent as any).rsvp_enabled && (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#D1FAE5', border: '1px solid #D1FAE5' }}>
              <Users size={18} style={{ color: '#2E7D32' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#2E7D32' }}>RSVP System Active</p>
                <p className="text-xs" style={{ color: '#4CAF50' }}>
                  {tiers.length} tier(s) configured. Manage tiers and RSVPs in the{' '}
                  <Link href={`/dashboard/rsvps/${initialEvent.id}`} className="underline font-semibold">
                    RSVP Settings
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          {!ticketUrl.trim() && !(initialEvent as any).rsvp_enabled && (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#FFF3E0', border: '1px solid #FEF3C7' }}>
              <Tag size={18} style={{ color: '#7C3AED' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#7C3AED' }}>No tickets configured</p>
                <p className="text-xs" style={{ color: '#E6A23C' }}>
                  Add an external ticket URL above, or use the built-in RSVP system in the{' '}
                  <Link href={`/dashboard/rsvps/${initialEvent.id}`} className="underline font-semibold">
                    RSVP Settings
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section: Embed Widget */}
      <div id="embed" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>
          <span className="flex items-center gap-2">
            <Code2 size={20} /> Embeddable Ticket Widget
          </span>
        </h2>
        <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
          Embed the ticket/RSVP form on your own website. Copy the code below and paste it into your HTML.
        </p>
        <EmbedCodeBlock shortId={shortId} />
      </div>

      {/* Section: Communication Timeline */}
      <div id="timeline" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>
          <span className="flex items-center gap-2">
            <Send size={20} /> Communication Timeline
          </span>
        </h2>
        <p className="text-sm mb-5" style={{ color: '#94A3B8' }}>
          Automated emails sent to attendees based on your event settings. This is read-only.
        </p>
        {(() => {
          const reminderOn = !!(initialEvent as any).reminder_enabled
          const steps = [
            { icon: Mail, title: 'Registration Confirmation', timing: 'Sent immediately when someone RSVPs', active: true, color: '#2E7D32' },
            { icon: Ticket, title: 'Ticket Email with QR Code', timing: 'Sent immediately on confirmation', active: true, color: '#1565C0' },
            { icon: Bell, title: '1-Day Reminder', timing: 'Sent 24 hours before event', active: reminderOn, color: '#7C3AED' },
            { icon: Clock, title: '3-Hour Reminder', timing: 'Sent 3 hours before event starts', active: reminderOn, color: '#7C3AED' },
            { icon: Send, title: 'Post-Event Follow-up', timing: 'Sent 1 day after event ends', active: true, color: '#4F46E5' },
            { icon: ClipboardCheck, title: 'Feedback Survey', timing: 'Link included in follow-up email', active: true, color: '#475569' },
          ]
          return (
            <div style={{ position: 'relative', paddingLeft: 32 }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 13, top: 8, bottom: 8, width: 2, background: 'linear-gradient(to bottom, #E2E8F0 0%, #4F46E5 20%, #4F46E5 80%, #E2E8F0 100%)', borderRadius: 1 }} />
              {steps.map((step, i) => {
                const Icon = step.icon
                return (
                  <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: i < steps.length - 1 ? 24 : 0, opacity: step.active ? 1 : 0.45 }}>
                    {/* Dot on timeline */}
                    <div style={{
                      position: 'absolute', left: -32, top: 4,
                      width: 28, height: 28, borderRadius: '50%',
                      background: step.active ? `${step.color}15` : '#F5F0EA',
                      border: `2px solid ${step.active ? step.color : '#D4C9BC'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 1,
                    }}>
                      <Icon size={12} style={{ color: step.active ? step.color : '#94A3B8' }} />
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: step.active ? '#0F172A' : '#94A3B8' }}>{step.title}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: step.active ? '#D1FAE5' : '#F5F0EA',
                          color: step.active ? '#2E7D32' : '#94A3B8',
                        }}>
                          {step.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{step.timing}</p>
                      {!step.active && (step.title.includes('Reminder')) && (
                        <p style={{ fontSize: 11, color: '#7C3AED', marginTop: 4, fontStyle: 'italic' }}>
                          Enable reminders in RSVP Settings to activate
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Section: Email Templates */}
      <div id="emails" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>
          <span className="flex items-center gap-2">
            <Mail size={20} /> Email Templates
          </span>
        </h2>
        <p className="text-sm mb-3" style={{ color: '#94A3B8' }}>
          Customize the emails sent to your attendees. Leave blank to use the default template.
        </p>
        <div className="rounded-lg p-3 mb-5 text-xs" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
          <span className="font-semibold" style={{ color: '#4F46E5' }}>Available variables:</span>{' '}
          <code>{'{{event_title}}'}</code>, <code>{'{{event_date}}'}</code>, <code>{'{{event_time}}'}</code>,{' '}
          <code>{'{{venue}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{attendee_name}}'}</code>,{' '}
          <code>{'{{ticket_number}}'}</code>, <code>{'{{confirmation_code}}'}</code>, <code>{'{{ticket_url}}'}</code>
        </div>
        <EmailTemplateEditor
          templates={emailTemplates}
          onChange={(updated) => {
            setEmailTemplates(updated)
            scheduleAutoSave({ email_templates: updated })
          }}
        />
      </div>

      {/* Section: Event Updates */}
      <div id="updates" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>
          <span className="flex items-center gap-2"><Bell size={20} /> Event Updates</span>
        </h2>
        <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
          Post updates visible to all attendees on their ticket page.
        </p>
        <EventUpdates eventId={initialEvent.id} />
      </div>

      {/* Section: Contact */}
      <div id="contact" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>Contact Info</h2>
        <div className="space-y-5">
          <div>
            <label className={labelClass} style={labelStyle}>Organizer Name *</label>
            <input
              type="text"
              value={publisherName}
              onChange={(e) => { setPublisherName(e.target.value); updateField('publisher_name', e.target.value) }}
              className={inputClass}
              style={inputStyle}
              placeholder="Your name or organization"
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Contact Email</label>
            <input
              type="email"
              value={profileEmail}
              disabled
              className={inputClass}
              style={{ ...inputStyle, backgroundColor: '#F5F0EA', color: '#94A3B8' }}
            />
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              From your profile. Update it in your account settings.
            </p>
          </div>
        </div>
      </div>

      {/* Section: Team */}
      <div id="team" className={sectionCardClass} style={sectionCardStyle}>
        <h2 className={sectionHeadClass} style={sectionHeadStyle}>
          <span className="flex items-center gap-2">
            <Users size={20} /> Team
          </span>
        </h2>
        <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
          Add staff who can help manage this event. Organizers get full access, check-in staff can scan tickets, viewers can see analytics.
        </p>
        <TeamManager eventId={initialEvent.id} />
      </div>

      {/* Danger Zone: Cancel Event */}
      {eventStatus !== 'rejected' && (
        <div className="rounded-2xl border-2 p-6 sm:p-8" style={{ borderColor: '#EF9A9A', backgroundColor: '#FFF5F5' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#C62828' }}>
            <AlertTriangle size={20} /> Danger Zone
          </h2>
          <p className="text-sm mb-4" style={{ color: '#4F46E5' }}>
            Irreversible actions that affect your event and all attendees.
          </p>

          {cancelResult && (
            <div className="px-4 py-3 rounded-lg text-sm mb-4" style={{ backgroundColor: cancelResult.includes('cancelled') ? '#D1FAE5' : '#FEE2E2', color: cancelResult.includes('cancelled') ? '#2E7D32' : '#C62828' }}>
              {cancelResult}
            </div>
          )}

          {showCancelConfirm ? (
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#FEE2E2', border: '1px solid #EF9A9A' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#C62828' }}>
                Are you sure you want to cancel this event?
              </p>
              <p className="text-xs mb-4" style={{ color: '#4F46E5' }}>
                All attendees will be notified and all tickets will be revoked. This cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelEvent}
                  disabled={cancelling}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#C62828', color: '#fff' }}
                >
                  <XCircle size={14} />
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Event'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
                  style={{ borderColor: '#E2E8F0', color: '#475569' }}
                >
                  No, Keep Event
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors hover:opacity-90"
              style={{ borderColor: '#C62828', color: '#C62828', backgroundColor: 'transparent' }}
            >
              <XCircle size={14} />
              Cancel Event
            </button>
          )}
        </div>
      )}

      {/* Show guide link */}
      {!showGuide && initialEvent.status !== 'published' && (
        <button
          onClick={() => setShowGuide(true)}
          className="text-sm underline"
          style={{ color: '#7C3AED' }}
        >
          Show setup guide
        </button>
      )}

      {/* Setup Guide Overlay */}
      {showGuide && (
        <SetupGuide onDismiss={dismissGuide} />
      )}
    </div>
  )
}
