'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, METRO_AREAS, cityMatchesMetro, getShortId, findMetroArea } from '@/lib/constants'
import type { Event, Profile } from '@/lib/types'
import { Check, X, Shield, Users, Calendar, AlertTriangle, Ban, UserCheck, Globe, User, MessageSquare, MapPin, Clock, ExternalLink, Image, CheckSquare, Square, Eye, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LinkPreview from '@/components/LinkPreview'

type Tab = 'queue' | 'all' | 'users' | 'apikeys' | 'memberships'
type StatusFilter = 'all' | 'pending' | 'published' | 'rejected' | 'deleted'
type SourceFilter = 'all' | 'manual' | 'crawler' | 'api'

/**
 * Colored chip showing the crawler's confidence in this event, plus
 * (on hover) which of the four signals scored what. Doesn't render
 * for non-crawler rows since manual submissions have no computed
 * confidence.
 */
function ConfidenceBadge({ event }: { event: Event }) {
  if (event.source !== 'crawler') return null
  const score = (event as any).crawler_confidence ?? 0
  const details = (event as any).confidence_details || {}
  const color =
    score >= 100 ? '#4F8C4F'
    : score >= 75 ? '#3E92CC'
    : score >= 50 ? '#4F46E5'
    : '#D94F4F'
  const tip = [
    details.image ? `Image ${details.image.score}/25 — ${details.image.reason}` : 'Image ?',
    details.date ? `Date ${details.date.score}/25 — ${details.date.reason}` : 'Date ?',
    details.location ? `Location ${details.location.score}/25 — ${details.location.reason}` : 'Location ?',
    details.ticket ? `Ticket ${details.ticket.score}/25 — ${details.ticket.reason}` : 'Ticket ?',
  ].join('\n')
  const count = (event as any).confidence_100_count || 0
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{
        backgroundColor: color + '20',
        color,
        borderColor: color + '80',
      }}
      title={tip + (count > 0 ? `\n\n100% verifications so far: ${count} / 2` : '')}
    >
      {score}%
      {count > 0 && score >= 100 && (
        <span className="ml-1 text-[9px] font-normal opacity-90">×{count}</span>
      )}
    </span>
  )
}

/**
 * Warning chips for every signal that didn't score a full 25. Renders
 * inline next to the confidence badge so the admin sees exactly what
 * the crawler couldn't verify before deciding whether to approve.
 * Non-crawler rows and events already at 100% render nothing.
 */
function SignalGaps({ event }: { event: Event }) {
  if (event.source !== 'crawler') return null
  const score = (event as any).crawler_confidence ?? 0
  if (score >= 100) return null
  const details = (event as any).confidence_details || {}
  const signals: { key: 'image' | 'date' | 'location' | 'ticket'; icon: string; label: string }[] = [
    { key: 'image', icon: '🖼', label: 'Image' },
    { key: 'date', icon: '📅', label: 'Date' },
    { key: 'location', icon: '📍', label: 'Location' },
    { key: 'ticket', icon: '🎫', label: 'Ticket' },
  ]
  const gaps = signals
    .map((s) => ({ ...s, entry: details[s.key] }))
    .filter((s) => !s.entry || (s.entry.score ?? 0) < 25)

  if (gaps.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {gaps.map((g) => {
        const s = g.entry?.score ?? 0
        const reason = g.entry?.reason ?? 'not yet scored'
        const detail = g.entry?.detail ? ` (${g.entry.detail})` : ''
        // Amber for partial (10-24), red for weak/missing (0-9). A
        // failed signal is a review target, not necessarily fatal —
        // amber matches the "please double-check" tone we want.
        const isRed = s < 10
        const color = isRed ? '#D94F4F' : '#4F46E5'
        return (
          <span
            key={g.key}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
            style={{
              backgroundColor: color + '15',
              color,
              borderColor: color + '55',
            }}
            title={`${g.label}: ${s}/25 — ${reason}${detail}`}
          >
            <span aria-hidden>{g.icon}</span>
            <span>{g.label}</span>
            <span className="opacity-70">{s}/25</span>
          </span>
        )
      })}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('queue')

  // Queue state
  const [pendingEvents, setPendingEvents] = useState<Event[]>([])
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [queueCityFilter, setQueueCityFilter] = useState('all')
  const [queueCategoryFilter, setQueueCategoryFilter] = useState('all')
  const [queueSourceFilter, setQueueSourceFilter] = useState<'all' | 'manual' | 'crawler' | 'api'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // All Events state
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [metroFilter, setMetroFilter] = useState<string>('all')
  const [autoApprovedOnly, setAutoApprovedOnly] = useState(false)
  const [sortColumn, setSortColumn] = useState<'title' | 'category' | 'city' | 'status' | 'source' | 'publisher_name' | 'date'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedAllEvents, setSelectedAllEvents] = useState<Set<string>>(new Set())

  // Rejection feedback modal state
  const [rejectingEvent, setRejectingEvent] = useState<Event | null>(null)
  const [rejectionFeedback, setRejectionFeedback] = useState('')

  // Publishers state
  const [publishers, setPublishers] = useState<(Profile & { event_count?: number })[]>([])

  useEffect(() => {
    const init = async () => {
      // Fast auth path: read cached session from cookies (~1ms) instead of
      // supabase.auth.getUser() which does a network round-trip on every
      // mount. The /admin middleware already keeps the cookie fresh.
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user
      if (!currentUser) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (!profileData || profileData.role !== 'admin') {
        router.push('/')
        return
      }

      // Fetch pending events via server API (bypasses RLS)
      const res = await fetch('/api/admin/events?type=pending')
      if (res.ok) {
        const eventsData = await res.json()
        setPendingEvents(eventsData as Event[])
      }
      setLoading(false)
    }

    init()
  }, [])

  useEffect(() => {
    if (!loading) {
      if (tab === 'queue') fetchPendingEvents()
      if (tab === 'all') fetchAllEvents()
      if (tab === 'users') fetchPublishers()
    }
  }, [tab, loading])

  const fetchPendingEvents = async () => {
    const res = await fetch('/api/admin/events?type=pending')
    if (res.ok) {
      const data = await res.json()
      setPendingEvents(data as Event[])
    }
  }

  const fetchAllEvents = async () => {
    const res = await fetch('/api/admin/events?type=all')
    if (res.ok) {
      const data = await res.json()
      setAllEvents(data as Event[])
    }
  }

  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', slug: '', bio: '' })

  const fetchPublishers = async () => {
    const res = await fetch(`/api/admin/events?type=profiles&role=${userRoleFilter}`)
    if (res.ok) {
      const data = await res.json()
      setPublishers(data)
    }
  }

  useEffect(() => {
    if (tab === 'users') fetchPublishers()
  }, [userRoleFilter])

  const handleChangeRole = async (profileId: string, role: string) => {
    const { ok } = await adminApi({ action: 'set-role', profileId, role })
    if (ok) fetchPublishers()
  }

  const handleEditUser = (pub: Profile & { event_count?: number }) => {
    setEditingUserId(pub.id)
    setEditUserForm({ name: pub.name || '', email: pub.email || '', slug: pub.slug || '', bio: pub.bio || '' })
  }

  const handleSaveUser = async (profileId: string) => {
    const { ok } = await adminApi({ action: 'edit-profile', profileId, fields: editUserForm })
    if (ok) { setEditingUserId(null); fetchPublishers() }
  }

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** All admin mutations go through the server API to bypass RLS. */
  const adminApi = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { ok: false, error: err.error }
    }
    return { ok: true }
  }

  const refreshCurrentTab = async () => {
    if (tab === 'all') await fetchAllEvents()
    if (tab === 'queue') await fetchPendingEvents()
    if (tab === 'users') await fetchPublishers()
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'set-status', id, status: 'published' })
    if (!ok) setActionError(`Failed to approve: ${error}`)
    setActionLoading(null)
    await fetchPendingEvents()
    if (tab === 'all') await fetchAllEvents()
  }

  const handleReject = async (event: Event) => {
    if (event.source === 'crawler') {
      if (!confirm(`Reject "${event.title}"? The crawler will not re-import it.`)) return
      setActionLoading(event.id)
      setActionError(null)
      const { ok, error } = await adminApi({ action: 'set-status', id: event.id, status: 'rejected' })
      if (!ok) setActionError(`Failed to reject: ${error}`)
      setActionLoading(null)
      await refreshCurrentTab()
    } else {
      setRejectingEvent(event)
      setRejectionFeedback('')
    }
  }

  const handleRejectWithFeedback = async () => {
    if (!rejectingEvent) return
    setActionLoading(rejectingEvent.id)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'set-status', id: rejectingEvent.id, status: 'rejected' })
    if (!ok) setActionError(`Failed to reject: ${error}`)
    setActionLoading(null)
    setRejectingEvent(null)
    setRejectionFeedback('')
    await refreshCurrentTab()
  }

  // ── Inline edit feature for queue events ──
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    title: string; category: string; description: string; venue: string; address: string;
    city: string; metro_region: string; state: string; zip_code: string;
    date: string; time: string; ticket_url: string; price: string; language: string;
  }>({
    title: '', category: '', description: '', venue: '', address: '',
    city: '', metro_region: '', state: '', zip_code: '',
    date: '', time: '', ticket_url: '', price: 'Free', language: '',
  })

  const startEdit = (event: Event) => {
    setEditingEventId(event.id)
    setEditForm({
      title: event.title || '',
      category: event.category || '',
      description: event.description || '',
      venue: event.venue || '',
      address: event.address || '',
      city: event.city || '',
      metro_region: METRO_AREAS.find(m => m.key === event.metro_region)?.key || findMetroArea(event.city) || event.metro_region || '',
      state: event.state || '',
      zip_code: event.zip_code || '',
      date: event.date || '',
      time: event.time || '',
      ticket_url: event.ticket_url || '',
      price: event.price || 'Free',
      language: event.language || '',
    })
  }

  const cancelEdit = () => {
    setEditingEventId(null)
  }

  const saveEdit = async (eventId: string) => {
    setActionLoading(eventId)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'edit', id: eventId, fields: { ...editForm } })
    if (!ok) setActionError(`Failed to save: ${error}`)
    setActionLoading(null)
    setEditingEventId(null)
    await fetchPendingEvents()
    if (tab === 'all') await fetchAllEvents()
  }

  const handleBulkApprove = async (ids: string[]) => {
    setActionLoading('bulk')
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'bulk-set-status', ids, status: 'published' })
    if (!ok) setActionError(`Failed to bulk approve: ${error}`)
    setSelectedEvents(new Set())
    setActionLoading(null)
    setBulkProgress(null)
    await fetchPendingEvents()
    if (tab === 'all') await fetchAllEvents()
  }

  const handleBulkRejectCrawler = async (events: Event[]) => {
    setActionLoading('bulk')
    setActionError(null)
    const crawlerIds = events.filter(e => e.source === 'crawler').map(e => e.id)
    if (crawlerIds.length) {
      const { ok, error } = await adminApi({ action: 'bulk-set-status', ids: crawlerIds, status: 'rejected' })
      if (!ok) setActionError(`Failed to bulk reject: ${error}`)
    }
    setSelectedEvents(new Set())
    setActionLoading(null)
    setBulkProgress(null)
    await fetchPendingEvents()
    if (tab === 'all') await fetchAllEvents()
  }

  const toggleSelectEvent = (id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedEvents.size === filteredPendingEvents.length) {
      setSelectedEvents(new Set())
    } else {
      setSelectedEvents(new Set(filteredPendingEvents.map(e => e.id)))
    }
  }

  const selectedPendingEvents = pendingEvents.filter(e => selectedEvents.has(e.id))
  const selectedCrawlerCount = selectedPendingEvents.filter(e => e.source === 'crawler').length
  const selectedManualCount = selectedPendingEvents.filter(e => e.source === 'manual').length

  const handleUnpublish = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'set-status', id, status: 'pending' })
    if (!ok) setActionError(`Failed to unpublish: ${error}`)
    setActionLoading(null)
    await fetchAllEvents()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this event? This cannot be undone.')) return
    setActionLoading(id)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'delete', ids: [id] })
    if (!ok) setActionError(`Failed to delete: ${error}`)
    setActionLoading(null)
    await refreshCurrentTab()
  }

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to permanently delete ${ids.length} event(s)? This cannot be undone.`)) return
    setActionLoading('bulk')
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'delete', ids })
    if (!ok) setActionError(`Failed to bulk delete: ${error}`)
    setActionLoading(null)
    setBulkProgress(null)
    setSelectedEvents(new Set())
    setSelectedAllEvents(new Set())
    await refreshCurrentTab()
  }

  const handleRestore = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const { ok, error } = await adminApi({ action: 'restore', id })
    if (!ok) setActionError(`Failed to restore: ${error}`)
    setActionLoading(null)
    await refreshCurrentTab()
  }

  const handleSuspend = async (id: string) => {
    await adminApi({ action: 'set-suspended', profileId: id, suspended: true })
    await fetchPublishers()
  }

  const handleReinstate = async (id: string) => {
    await adminApi({ action: 'set-suspended', profileId: id, suspended: false })
    await fetchPublishers()
  }

  const getCategoryEmoji = (key: string) => {
    const cat = CATEGORIES.find((c) => c.key === key)
    return cat ? cat.emoji : ''
  }

  const getCategoryLabel = (key: string) => {
    const cat = CATEGORIES.find((c) => c.key === key)
    return cat ? cat.label : key
  }

  const statusBadge = (status: string, event?: Event) => {
    const isDeleted = event && (event as any).deleted_at
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      published: 'bg-green-100 text-green-700 border-green-300',
      rejected: 'bg-red-100 text-red-700 border-red-300',
    }
    return (
      <span className="flex items-center gap-1">
        <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[status] || ''}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {isDeleted && (
          <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-50 text-[#475569] border-gray-200">
            Deleted
          </span>
        )}
      </span>
    )
  }

  const sourceBadge = (source: Event['source']) => {
    if (source === 'crawler') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
          <Globe size={10} />
          Crawler
        </span>
      )
    }
    if (source === 'api') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700 border border-teal-200">
          <Globe size={10} />
          API
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
        <User size={10} />
        Publisher
      </span>
    )
  }

  // Use METRO_AREAS for the dropdown (always has all options regardless of loaded data)
  const allMetrosPresent = METRO_AREAS.filter(m => m.key !== 'All Cities').map(m => m.key)

  const filteredEvents = allEvents.filter((e) => {
    const isDeleted = !!(e as any).deleted_at
    const matchesStatus = statusFilter === 'deleted'
      ? isDeleted
      : statusFilter === 'all'
        ? !isDeleted
        : (!isDeleted && e.status === statusFilter)
    const matchesSource = sourceFilter === 'all' || e.source === sourceFilter
    const matchesMetro = metroFilter === 'all' || (e.metro_region || 'Other') === metroFilter
    const matchesAuto = !autoApprovedOnly || (e as any).auto_approved === true
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const searchable = `${e.title} ${e.city} ${e.venue} ${e.description}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return matchesStatus && matchesSource && matchesMetro && matchesAuto
  }).sort((a, b) => {
    const col = sortColumn
    const dir = sortDirection === 'asc' ? 1 : -1
    const valA = (a as any)[col] ?? ''
    const valB = (b as any)[col] ?? ''
    if (col === 'date') {
      return dir * (new Date(valA).getTime() - new Date(valB).getTime())
    }
    return dir * String(valA).localeCompare(String(valB))
  })

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  const SortHeader = ({ col, label }: { col: typeof sortColumn; label: string }) => (
    <th
      className="py-3 px-4 cursor-pointer select-none hover:text-[#4F46E5] transition-colors"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortColumn === col ? (
          <span className="text-[#4F46E5]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-[#94A3B8]">⇅</span>
        )}
      </span>
    </th>
  )

  // Region/city filter: the metro-level "Bay Area" option matches anything
  // whose location string contains a BA marker; the individual sub-city
  // options (San Jose, Fremont, Cupertino, …) match the row's city column
  // exactly. So an admin can filter the whole queue to "Bay Area" or drill
  // down to a specific city for a focused approval pass.
  const BAY_AREA_MARKERS = [
    'bay area', 'san francisco', 'sf ', ' sf,', 'sf bay',
    'san jose', 'oakland', 'berkeley', 'palo alto', 'mountain view',
    'cupertino', 'sunnyvale', 'santa clara', 'fremont', 'milpitas',
    'redwood city', 'menlo park', 'foster city', 'san mateo', 'burlingame',
    'hayward', 'union city', 'pleasanton', 'dublin', 'livermore',
    'walnut creek', 'concord', 'el cerrito', 'alameda',
    'castro valley', 'san leandro', 'daly city', 'south san francisco',
    'south sf', 'pacifica', 'half moon bay', 'saratoga', 'los gatos',
    'los altos', 'campbell', 'morgan hill', 'gilroy', 'san bruno', 'millbrae',
    'pleasant hill', 'martinez',
    'fairfield', 'vallejo', 'napa', 'sonoma', 'santa rosa', 'petaluma',
    'novato', 'san rafael', 'mill valley', 'sausalito', 'tiburon',
    'south bay', 'east bay', 'north bay', 'peninsula',
  ]
  const isBayArea = (e: Event) => {
    const loc = `${e.city || ''} ${e.state || ''} ${e.venue || ''}`.toLowerCase()
    return BAY_AREA_MARKERS.some((m) => loc.includes(m))
  }

  // City filter uses real metros (Bay Area, LA, NYC, Dallas, Chicago, …),
  // matched against the row's city via cityMatchesMetro from constants —
  // so picking "Bay Area" matches Sunnyvale / Milpitas / SF / Fremont /
  // Cupertino / etc., and picking "LA" matches Pasadena / Burbank /
  // Anaheim / Irvine / Long Beach, etc.
  function metroOf(e: Event): string {
    // Use the stored metro_region if it's a valid key (not 'Other' or empty)
    if (e.metro_region && e.metro_region !== 'Other' && METRO_AREAS.some(m => m.key === e.metro_region)) {
      return e.metro_region
    }
    // Fall back to detection from city name
    if (isBayArea(e)) return 'Bay Area'
    for (const m of METRO_AREAS) {
      if (m.key === 'All Cities' || m.key === 'Other' || m.key === 'Bay Area') continue
      if (cityMatchesMetro(e.city || '', m.key)) return m.key
    }
    return 'Other'
  }

  const filteredPendingEvents = pendingEvents.filter((e) => {
    if (queueCityFilter !== 'all' && metroOf(e) !== queueCityFilter) return false
    if (queueCategoryFilter !== 'all' && e.category !== queueCategoryFilter) return false
    if (queueSourceFilter !== 'all' && e.source !== queueSourceFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const searchable = `${e.title} ${e.city} ${e.venue} ${e.description}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  // Metro options actually present in the queue, sorted with Bay Area
  // first (the site's home region) then every other metro alphabetical.
  const queueMetrosPresent = Array.from(new Set(pendingEvents.map(metroOf)))
  const queueCities = queueMetrosPresent.sort((a, b) => {
    if (a === 'Bay Area') return -1
    if (b === 'Bay Area') return 1
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b)
  })

  // ── Recurring-event grouping ──
  // Same event series at multiple dates collapses to one card. The key is
  // the first 3 alphanumeric tokens of the normalized title — that catches
  // "Bollywood Festive Nights at Union Square" / "Bollywood Festive Nights
  // at Union Squar" / "Bollywood Festive Nights Union Square" as the same
  // event despite the title typos. The card uses whichever instance has the
  // most complete data (image, ticket URL, longer title) as its template;
  // every action — select / approve / reject — fans out to all instances.
  function normalizeTitleKey(t: string): string {
    return (t || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 3)
      .join(' ')
  }
  function groupKey(e: Event): string {
    return normalizeTitleKey(e.title)
  }
  function completeness(e: Event): number {
    let s = 0
    if (e.image_url && e.image_url.length > 5) s += 4
    if (e.ticket_url && !e.ticket_url.includes('google.com/search')) s += 3
    if (e.venue && e.venue.length > 2) s += 2
    if (e.description && e.description.length > 50) s += 1
    s += Math.min((e.title || '').length, 80) / 100  // prefer longer/more complete titles
    return s
  }
  interface Occurrence { key: string; rep: Event; allIds: string[] }
  interface EventGroup { key: string; rep: Event; events: Event[]; occurrences: Occurrence[] }
  function buildGroups(events: Event[]): EventGroup[] {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const k = groupKey(e)
      const arr = map.get(k) || []
      arr.push(e)
      map.set(k, arr)
    }
    const groups: EventGroup[] = []
    Array.from(map.entries()).forEach(([k, evs]) => {
      evs.sort((a: Event, b: Event) => (a.date || '').localeCompare(b.date || ''))
      const rep = [...evs].sort((a: Event, b: Event) => completeness(b) - completeness(a))[0]

      // Dedupe within the series by (date, time). Multiple DB rows for the
      // same event at the same date+time collapse into a single Occurrence.
      // The Occurrence carries every duplicate's id so an admin's single
      // Approve / Reject click silently fans out to all of them.
      const byDT = new Map<string, Event[]>()
      for (const ev of evs) {
        const dtKey = `${ev.date || ''}|${(ev.time || '').trim().toLowerCase()}`
        const arr = byDT.get(dtKey) || []
        arr.push(ev)
        byDT.set(dtKey, arr)
      }
      const occurrences: Occurrence[] = []
      Array.from(byDT.entries()).forEach(([dtKey, dtEvents]) => {
        dtEvents.sort((a: Event, b: Event) => completeness(b) - completeness(a))
        occurrences.push({ key: dtKey, rep: dtEvents[0], allIds: dtEvents.map((e) => e.id) })
      })
      occurrences.sort((a, b) => (a.rep.date || '').localeCompare(b.rep.date || ''))

      groups.push({ key: k, events: evs, rep, occurrences })
    })
    // Earliest date first
    groups.sort((a, b) => (a.rep.date || '').localeCompare(b.rep.date || ''))
    return groups
  }
  const queueGroups = buildGroups(filteredPendingEvents)

  // Pagination — render 20 group cards per page so the DOM stays responsive
  // no matter how big the queue gets. Reset to page 1 whenever a filter
  // changes so the admin isn't stranded on page 12 of a smaller filtered set.
  const PAGE_SIZE = 20
  const [queuePage, setQueuePage] = useState(1)
  useEffect(() => { setQueuePage(1) }, [queueCityFilter, queueCategoryFilter, queueSourceFilter, searchQuery])
  const totalPages = Math.max(1, Math.ceil(queueGroups.length / PAGE_SIZE))
  const currentPage = Math.min(queuePage, totalPages)
  const pagedGroups = queueGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function formatGroupDate(d: string): string {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  async function handleApproveGroup(events: Event[]) {
    const groupActionKey = `group:${groupKey(events[0])}`
    setActionLoading(groupActionKey)
    setActionError(null)
    const ids = events.map((e) => e.id)
    const { ok, error } = await adminApi({ action: 'bulk-set-status', ids, status: 'published' })
    setActionLoading(null)
    if (!ok) {
      setActionError(`Approve failed: ${error}`)
    } else {
      setSelectedEvents((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }
    await fetchPendingEvents()
  }

  async function handleRejectGroup(events: Event[]) {
    const groupActionKey = `group:${groupKey(events[0])}`
    setActionLoading(groupActionKey)
    setActionError(null)
    const allIds = events.map((e) => e.id)
    if (allIds.length) {
      const { ok, error } = await adminApi({ action: 'bulk-set-status', ids: allIds, status: 'rejected' })
      if (!ok) setActionError(`Reject failed: ${error}`)
    }
    setActionLoading(null)
    await fetchPendingEvents()
  }
  function toggleSelectGroup(events: Event[]) {
    const ids = events.map((e) => e.id)
    const anySelected = ids.some((id) => selectedEvents.has(id))
    const next = new Set(selectedEvents)
    if (anySelected) ids.forEach((id) => next.delete(id))
    else ids.forEach((id) => next.add(id))
    setSelectedEvents(next)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#4F46E5]" />
      </div>
    )
  }

  const tabButton = (key: Tab, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        tab === key
          ? 'bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/30'
          : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0]/30 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield size={28} className="text-[#4F46E5]" />
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
          >
            Admin Panel
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabButton('queue', 'Approval Queue', <AlertTriangle size={16} />)}
          {tabButton('all', 'All Events', <Calendar size={16} />)}
          {tabButton('users', 'Users', <Users size={16} />)}
          {tabButton('apikeys', 'API Keys', <Shield size={16} />)}
          {tabButton('memberships', 'Memberships', <Users size={16} />)}
        </div>

        {/* Search */}
        {tab !== 'users' && tab !== 'apikeys' && (
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by title, city, venue..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-[#E2E8F0] text-[#334155] placeholder-[#94A3B8] focus:border-[#4F46E5] focus:outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          </div>
        )}

        {/* Global error banner */}
        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-red-800 mb-1">Action failed</div>
              <div>{actionError}</div>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-800">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Approval Queue Tab */}
        {tab === 'queue' && (
          <div>
            {/* Queue Filters */}
            {pendingEvents.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-xs text-[#94A3B8] uppercase tracking-wider">Filter queue:</span>
                <select
                  value={queueCityFilter}
                  onChange={(e) => setQueueCityFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white border border-[#E2E8F0] text-[#334155] focus:border-[#4F46E5] focus:outline-none"
                >
                  <option value="all">All Regions ({new Set(pendingEvents.map(groupKey)).size})</option>
                  {queueCities.map((metroKey) => {
                    // Show visible card count (unique event series) rather than
                    // the raw row count so the number matches what the admin sees.
                    const seenTitleKeys = new Set<string>()
                    const cardCount = pendingEvents.filter((e) => {
                      if (metroOf(e) !== metroKey) return false
                      const k = groupKey(e)
                      if (seenTitleKeys.has(k)) return false
                      seenTitleKeys.add(k)
                      return true
                    }).length
                    const count = cardCount
                    const label = METRO_AREAS.find((m) => m.key === metroKey)?.label || metroKey
                    return <option key={metroKey} value={metroKey}>{label} ({count})</option>
                  })}
                </select>
                <select
                  value={queueCategoryFilter}
                  onChange={(e) => setQueueCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white border border-[#E2E8F0] text-[#334155] focus:border-[#4F46E5] focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>
                  ))}
                </select>
                <select
                  value={queueSourceFilter}
                  onChange={(e) => setQueueSourceFilter(e.target.value as 'all' | 'manual' | 'crawler' | 'api')}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white border border-[#E2E8F0] text-[#334155] focus:border-[#4F46E5] focus:outline-none"
                >
                  <option value="all">All Sources</option>
                  <option value="crawler">Crawler</option>
                  <option value="manual">Publisher / Guest</option>
                  <option value="api">API</option>
                </select>
                <span className="text-xs text-[#94A3B8]">
                  Showing {new Set(filteredPendingEvents.map(groupKey)).size} of {new Set(pendingEvents.map(groupKey)).size} event series
                </span>
              </div>
            )}

            {pendingEvents.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                <Check size={40} className="mx-auto text-green-500 mb-3" />
                <p className="text-[#94A3B8] text-sm">No pending events. All caught up!</p>
              </div>
            ) : filteredPendingEvents.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                <p className="text-[#94A3B8] text-sm">No events match the selected filters.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Bulk Actions Toolbar */}
                <div className="sticky top-0 z-10 bg-white border border-[#E2E8F0] rounded-xl p-3 flex flex-wrap items-center gap-3">
                  {/* Select All checkbox */}
                  <button
                    onClick={toggleSelectAll}
                    disabled={actionLoading === 'bulk'}
                    className="flex items-center gap-2 text-sm text-[#334155] hover:text-[#0F172A] transition-colors disabled:opacity-50"
                  >
                    {selectedEvents.size === filteredPendingEvents.length && filteredPendingEvents.length > 0 ? (
                      <CheckSquare size={18} className="text-[#4F46E5]" />
                    ) : (
                      <Square size={18} className="text-[#94A3B8]" />
                    )}
                    {selectedEvents.size === filteredPendingEvents.length && filteredPendingEvents.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>

                  {/* Selection count badge */}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#4F46E5]/15 text-[#4F46E5] border border-[#4F46E5]/30">
                    {selectedEvents.size} of {filteredPendingEvents.length} selected
                  </span>

                  <span className="w-px h-5 bg-[#E2E8F0] mx-1" />

                  {/* Bulk action progress */}
                  {actionLoading === 'bulk' && bulkProgress && (
                    <span className="text-xs text-[#4F46E5] animate-pulse">
                      Processing... ({bulkProgress.current}/{bulkProgress.total})
                    </span>
                  )}

                  {/* Approve Selected */}
                  <button
                    onClick={() => handleBulkApprove(Array.from(selectedEvents))}
                    disabled={selectedEvents.size === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check size={14} />
                    Approve Selected
                  </button>

                  {/* Reject Selected */}
                  <button
                    onClick={() => {
                      if (selectedManualCount > 0) {
                        alert(`${selectedManualCount} manual event(s) need individual feedback and will be skipped. Only ${selectedCrawlerCount} crawler event(s) will be deleted.`)
                      }
                      if (selectedCrawlerCount > 0) {
                        handleBulkRejectCrawler(selectedPendingEvents)
                      }
                    }}
                    disabled={selectedEvents.size === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <X size={14} />
                    Reject Selected
                  </button>

                  {/* Delete Selected */}
                  <button
                    onClick={() => handleBulkDelete(Array.from(selectedEvents))}
                    disabled={selectedEvents.size === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-[#475569] border border-gray-200 hover:bg-red-50 hover:text-red-800 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    🗑 Delete Selected
                  </button>

                  <span className="w-px h-5 bg-[#E2E8F0] mx-1" />

                  {/* Approve All */}
                  <button
                    onClick={() => handleBulkApprove(filteredPendingEvents.map(e => e.id))}
                    disabled={filteredPendingEvents.length === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check size={14} />
                    Approve All
                  </button>

                  {/* Reject All Crawler */}
                  <button
                    onClick={() => handleBulkRejectCrawler(filteredPendingEvents)}
                    disabled={filteredPendingEvents.filter(e => e.source === 'crawler').length === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <X size={14} />
                    Reject All Crawler
                  </button>

                  {/* Delete All */}
                  <button
                    onClick={() => handleBulkDelete(filteredPendingEvents.map(e => e.id))}
                    disabled={filteredPendingEvents.length === 0 || actionLoading === 'bulk'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] border border-gray-200 hover:bg-red-50 hover:text-red-800 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    🗑 Delete All
                  </button>
                </div>

                {pagedGroups.map((group, cardIdx) => {
                  const event = group.rep
                  const groupIds = group.events.map((e) => e.id)
                  const allSelected = groupIds.every((id) => selectedEvents.has(id))
                  const anySelected = groupIds.some((id) => selectedEvents.has(id))
                  const groupLoading = group.events.some((e) => actionLoading === e.id) || actionLoading === `group:${group.key}`
                  const category = CATEGORIES.find(c => c.key === event.category) || CATEGORIES[0]
                  return (
                    <motion.div
                      key={group.key}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                        delay: Math.min(cardIdx * 0.03, 0.24),
                      }}
                      className={`bg-white border rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_30px_-16px_rgba(123,31,31,0.25)] transition-shadow ${anySelected ? 'border-[#4F46E5]/50' : 'border-[#E2E8F0]'}`}
                    >
                      {/* Poster + Event Preview */}
                      <div className="flex flex-col md:flex-row">
                        {/* Group-level checkbox */}
                        <div className="flex items-center justify-center px-3 md:pl-4 md:pr-0 pt-3 md:pt-0">
                          <button
                            onClick={() => toggleSelectGroup(group.events)}
                            className="flex-shrink-0"
                            title={group.occurrences.length > 1 ? `Toggles all ${group.occurrences.length} dates` : undefined}
                          >
                            {allSelected ? (
                              <CheckSquare size={20} className="text-[#4F46E5]" />
                            ) : anySelected ? (
                              <CheckSquare size={20} className="text-[#4F46E5]/40" />
                            ) : (
                              <Square size={20} className="text-[#94A3B8] hover:text-[#334155] transition-colors" />
                            )}
                          </button>
                        </div>
                        {/* Poster */}
                        <div className="md:w-72 lg:w-80 flex-shrink-0">
                          {event.image_url ? (
                            <div className="relative h-52 md:h-full min-h-[200px]">
                              <img
                                src={event.image_url}
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-[#0F172A] bg-gradient-to-r ${category.gradient}`}>
                                  {category.emoji} {category.label}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className={`relative h-52 md:h-full min-h-[200px] bg-gradient-to-br ${category.gradient} flex flex-col items-center justify-center`} style={{ opacity: 0.15 }}>
                              <span className="text-6xl">{category.emoji}</span>
                              <span className="text-sm text-[#0F172A]/60 mt-2">{category.label}</span>
                            </div>
                          )}
                          {!event.image_url && (
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 text-xs text-yellow-600">
                              <Image size={12} />
                              No poster
                            </div>
                          )}
                        </div>

                        {/* Event Info */}
                        <div className="flex-1 p-5 space-y-3">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold" style={{ fontFamily: 'Plus Jakarta Sans, serif' }}>
                                {event.ticket_url ? (
                                  <a
                                    href={event.ticket_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0F172A] hover:text-[#4F46E5] transition-colors inline-flex items-baseline gap-1.5 group/title"
                                    title={`Open ticket URL: ${event.ticket_url}`}
                                  >
                                    {event.title}
                                    <ExternalLink size={14} className="opacity-40 group-hover/title:opacity-100 transition-opacity flex-shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-[#0F172A]">{event.title}</span>
                                )}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {sourceBadge(event.source)}
                                <ConfidenceBadge event={event} />
                                {(event as any).auto_approved && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ backgroundColor: 'rgba(46, 125, 50, 0.2)', color: '#4F8C4F', border: '1px solid rgba(46, 125, 50, 0.4)' }}
                                    title="Auto-approved by the crawler after two 100% verifications"
                                  >
                                    ✨ Auto
                                  </span>
                                )}
                                <span className="text-xs text-[#94A3B8]">
                                  {event.source === 'crawler' ? 'via Crawler' : `by ${event.publisher_name}`}
                                </span>
                                <span className="text-xs text-[#94A3B8]">
                                  Submitted {new Date(event.submitted_at).toLocaleDateString()}
                                </span>
                              </div>
                              <SignalGaps event={event} />
                            </div>
                            <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              event.price === 'Free' ? 'bg-emerald-500/90 text-[#0F172A]' : 'text-[#F8FAFC]'
                            }`} style={event.price === 'Paid' ? { backgroundColor: '#4F46E5' } : undefined}>
                              {event.price}
                            </span>
                          </div>

                          {/* Details grid — date is replaced below by the multi-date strip when group.events.length > 1 */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            {group.occurrences.length === 1 && (
                              <div className="flex items-center gap-2 text-[#334155]">
                                <Calendar size={14} className="text-[#4F46E5] flex-shrink-0" />
                                <span>{formatGroupDate(event.date)}</span>
                                {event.time && <span className="text-[#94A3B8]">· {event.time}</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[#334155]">
                              <MapPin size={14} className={`flex-shrink-0 ${metroOf(event) === 'Bay Area' ? 'text-[#4F46E5]' : 'text-red-700'}`} />
                              <span className={`truncate ${metroOf(event) === 'Bay Area' ? '' : 'text-red-700 font-medium'}`}>
                                {metroOf(event)}
                              </span>
                              <span className="text-xs text-[#94A3B8] truncate">· {event.city || 'no city'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#334155]">
                              <MapPin size={14} className="text-[#94A3B8] flex-shrink-0" />
                              <span className="truncate">{event.venue || 'Venue TBA'}</span>
                            </div>
                          </div>

                          {/* Multi-date strip — each occurrence gets its own
                              approve / reject buttons so the admin can accept
                              some dates and drop others without touching the
                              rest. Bottom-of-card "Approve all N" still fires
                              across every remaining instance. */}
                          {group.occurrences.length > 1 && (
                            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar size={14} className="text-[#4F46E5]" />
                                <span className="text-xs font-medium text-[#334155]" style={{ fontFamily: 'Inter, sans-serif' }}>
                                  {group.occurrences.length} dates · approve or reject each one individually
                                </span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <AnimatePresence initial={false}>
                                  {group.occurrences.map((occ) => {
                                    const rowLoading = occ.allIds.some((id) => actionLoading === id)
                                    return (
                                      <motion.div
                                        key={occ.key}
                                        layout
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white border border-[#E2E8F0]"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1 text-xs text-[#334155]" style={{ fontFamily: 'Inter, sans-serif' }}>
                                          <Calendar size={12} className="text-[#4F46E5] flex-shrink-0" />
                                          <span className="truncate">
                                            {formatGroupDate(occ.rep.date)}
                                            {occ.rep.time && <span className="text-[#94A3B8]"> · {occ.rep.time}</span>}
                                            {occ.allIds.length > 1 && <span className="text-[#94A3B8]"> · {occ.allIds.length} duplicate rows</span>}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <button
                                            onClick={() => handleApproveGroup(occ.allIds.map((id) => group.events.find((e) => e.id === id)!).filter(Boolean))}
                                            disabled={rowLoading || groupLoading}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
                                            title={occ.allIds.length > 1 ? `Approve this date (${occ.allIds.length} duplicate rows silently included)` : 'Approve just this date'}
                                          >
                                            <Check size={11} />
                                            {rowLoading ? '…' : 'Approve'}
                                          </button>
                                          <button
                                            onClick={() => handleRejectGroup(occ.allIds.map((id) => group.events.find((e) => e.id === id)!).filter(Boolean))}
                                            disabled={rowLoading || groupLoading}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
                                            title={occ.allIds.length > 1 ? `Reject this date (${occ.allIds.length} duplicate rows silently included)` : 'Reject just this date'}
                                          >
                                            <X size={11} />
                                            {occ.rep.source === 'crawler' ? 'Delete' : 'Reject'}
                                          </button>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}

                          {/* Inline edit form for location */}
                          {editingEventId === event.id && (
                            <div className="bg-[#F8FAFC] border border-[#4F46E5]/30 rounded-lg p-4 space-y-3">
                              <div className="text-xs text-[#4F46E5] font-medium">Edit Event</div>

                              {/* Title */}
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Title</label>
                                <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Event title" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                              </div>

                              {/* Category + Price + Language */}
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Category</label>
                                  <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    <option value="">Select</option>
                                    {CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Price</label>
                                  <select value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    <option value="Free">Free</option>
                                    <option value="Paid">Paid</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Language</label>
                                  <input type="text" value={editForm.language} onChange={(e) => setEditForm({ ...editForm, language: e.target.value })} placeholder="e.g. Hindi, English" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                              </div>

                              {/* Description */}
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Description</label>
                                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Event description" rows={3} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none resize-none" />
                              </div>

                              {/* Date + Time */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Date</label>
                                  <input type="text" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} placeholder="e.g. 2026-07-15" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Time</label>
                                  <input type="text" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} placeholder="e.g. 7:00 PM" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                              </div>

                              {/* Venue + Address */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Venue</label>
                                  <input type="text" value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} placeholder="Venue name" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Address</label>
                                  <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Full address" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                              </div>

                              {/* City + Metro + State + Zip */}
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">City</label>
                                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Metro</label>
                                  <select value={editForm.metro_region} onChange={(e) => setEditForm({ ...editForm, metro_region: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    <option value="">Select Metro</option>
                                    {METRO_AREAS.filter(m => m.key !== 'All Cities').map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">State</label>
                                  <input type="text" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} placeholder="State" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Zip</label>
                                  <input type="text" value={editForm.zip_code} onChange={(e) => setEditForm({ ...editForm, zip_code: e.target.value })} placeholder="Zip" className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                              </div>

                              {/* Ticket URL */}
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Ticket URL</label>
                                <input type="text" value={editForm.ticket_url} onChange={(e) => setEditForm({ ...editForm, ticket_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                              </div>

                              {/* Save / Cancel */}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => saveEdit(event.id)} disabled={actionLoading === event.id} className="px-4 py-1.5 rounded text-xs bg-[#4F46E5] text-[#F8FAFC] font-medium hover:opacity-90 disabled:opacity-50">
                                  {actionLoading === event.id ? 'Saving...' : 'Save All Changes'}
                                </button>
                                <button onClick={cancelEdit} className="px-4 py-1.5 rounded text-xs text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Description */}
                          <div className="text-sm text-[#475569] leading-relaxed line-clamp-3">
                            {event.description || <span className="text-[#94A3B8] italic">No description</span>}
                          </div>

                          {/* Ticket URL */}
                          {event.ticket_url && (
                            <div className="flex items-center gap-2">
                              <ExternalLink size={13} className="text-[#94A3B8] flex-shrink-0" />
                              <LinkPreview
                                href={event.ticket_url}
                                className="text-xs text-blue-700 hover:text-blue-700 truncate max-w-md transition-colors inline-block align-middle"
                              >
                                {event.ticket_url}
                              </LinkPreview>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-col gap-2 pt-2 border-t border-[#E2E8F0]">
                            {actionError && actionLoading === null && (
                              <div className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                                {actionError}
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleApproveGroup(group.events)}
                                disabled={groupLoading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
                              >
                                <Check size={15} />
                                {groupLoading ? 'Processing...' : group.occurrences.length > 1 ? `Approve all ${group.occurrences.length}` : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleRejectGroup(group.events)}
                                disabled={groupLoading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
                              >
                                <X size={15} />
                                {group.occurrences.length > 1
                                  ? `Reject all ${group.occurrences.length}`
                                  : event.source === 'crawler' ? 'Reject & Delete' : 'Reject'}
                              </button>
                              <button
                                onClick={() => handleBulkDelete(group.events.map(e => e.id))}
                                disabled={groupLoading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-[#475569] border border-gray-200 hover:bg-red-50 hover:text-red-800 hover:border-red-200 disabled:opacity-50 disabled:cursor-wait transition-colors"
                                title="Permanently delete from database"
                              >
                                🗑 Delete
                              </button>
                              <LinkPreview
                                href={`/e/${getShortId(event.id)}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                <Eye size={15} />
                                Preview
                              </LinkPreview>
                              {editingEventId !== event.id && (
                                <button
                                  onClick={() => startEdit(event)}
                                  disabled={groupLoading}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#4F46E5]/15 text-[#4F46E5] border border-[#4F46E5]/30 hover:bg-[#4F46E5]/25 disabled:opacity-50 transition-colors"
                                >
                                  Edit Location
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-[#E2E8F0]">
                    <div className="text-xs text-[#475569]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Showing <span className="text-[#334155] font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span>
                      –<span className="text-[#334155] font-medium">{Math.min(currentPage * PAGE_SIZE, queueGroups.length)}</span>
                      {' '}of{' '}
                      <span className="text-[#334155] font-medium">{queueGroups.length}</span> event series
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#334155] border border-[#E2E8F0] bg-white hover:border-gray-500 hover:text-[#0F172A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        <ChevronLeft size={13} />
                        Prev
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(7, totalPages) }).map((_, i) => {
                          let n = i + 1
                          if (totalPages > 7) {
                            if (currentPage <= 4) n = i + 1
                            else if (currentPage >= totalPages - 3) n = totalPages - 6 + i
                            else n = currentPage - 3 + i
                          }
                          if (n < 1 || n > totalPages) return null
                          const active = n === currentPage
                          return (
                            <button
                              key={n}
                              onClick={() => setQueuePage(n)}
                              className={`min-w-[28px] px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-[#4F46E5] text-[#F8FAFC]'
                                  : 'text-[#475569] border border-[#E2E8F0] hover:text-[#0F172A] hover:border-gray-500'
                              }`}
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                              {n}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => setQueuePage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#334155] border border-[#E2E8F0] bg-white hover:border-gray-500 hover:text-[#0F172A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        Next
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* All Events Tab */}
        {tab === 'all' && (
          <div>
            {/* Status filter buttons */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(['all', 'pending', 'published', 'rejected', 'deleted'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f
                      ? 'bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/30'
                      : 'text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}

              <span className="w-px h-5 bg-[#E2E8F0] mx-1 self-center" />

              {([
                { key: 'all', label: 'All Sources' },
                { key: 'manual', label: 'Publisher' },
                { key: 'crawler', label: 'Crawler' },
                { key: 'api', label: 'API' },
              ] as { key: SourceFilter; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSourceFilter(f.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sourceFilter === f.key
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30'
                  }`}
                >
                  {f.key === 'crawler' && <Globe size={12} />}
                  {f.key === 'manual' && <User size={12} />}
                  {f.label}
                </button>
              ))}

              <span className="w-px h-5 bg-[#E2E8F0] mx-1 self-center" />

              {/* Metro filter */}
              <select
                value={metroFilter}
                onChange={(e) => setMetroFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  metroFilter !== 'all'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-[#334155] border border-[#E2E8F0] bg-white'
                }`}
                style={{ colorScheme: 'light' }}
              >
                <option value="all">All Metros</option>
                {allMetrosPresent.map((m) => {
                  const label = METRO_AREAS.find(ma => ma.key === m)?.label || m
                  return <option key={m} value={m}>{label}</option>
                })}
              </select>

              <span className="w-px h-5 bg-[#E2E8F0] mx-1 self-center" />

              <button
                onClick={() => setAutoApprovedOnly((v) => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  autoApprovedOnly
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30'
                }`}
                title="Show only events auto-approved by the crawler after two 100% verifications"
              >
                ✨ Auto-approved
              </button>
            </div>

            {/* Bulk action bar */}
            {selectedAllEvents.size > 0 && (
              <div className="flex items-center gap-3 mb-4 bg-[#4F46E5]/10 border border-[#4F46E5]/30 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-[#4F46E5]">{selectedAllEvents.size} selected</span>
                <button
                  onClick={() => handleBulkDelete(Array.from(selectedAllEvents))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  🗑 Delete Selected
                </button>
                <button
                  onClick={() => setSelectedAllEvents(new Set())}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                <Calendar size={40} className="mx-auto text-[#94A3B8] mb-3" />
                <p className="text-[#94A3B8] text-sm">No events found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-xs text-[#94A3B8] uppercase tracking-wider">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedAllEvents.size === filteredEvents.length && filteredEvents.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAllEvents(new Set(filteredEvents.map(ev => ev.id)))
                            } else {
                              setSelectedAllEvents(new Set())
                            }
                          }}
                          className="accent-[#4F46E5] cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      <SortHeader col="title" label="Title" />
                      <SortHeader col="category" label="Category" />
                      <SortHeader col="city" label="City" />
                      <SortHeader col="status" label="Status" />
                      <SortHeader col="source" label="Source" />
                      <SortHeader col="publisher_name" label="Publisher" />
                      <SortHeader col="date" label="Date" />
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <React.Fragment key={event.id}>
                      <tr
                        className={`border-b border-[#E2E8F0]/50 hover:bg-[#E2E8F0]/20 transition-colors ${selectedAllEvents.has(event.id) ? 'bg-[#4F46E5]/5' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedAllEvents.has(event.id)}
                            onChange={(e) => {
                              const next = new Set(selectedAllEvents)
                              if (e.target.checked) next.add(event.id)
                              else next.delete(event.id)
                              setSelectedAllEvents(next)
                            }}
                            className="accent-[#4F46E5] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-medium max-w-[200px] truncate">
                          <a
                            href={`/e/${getShortId(event.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0F172A] hover:text-[#4F46E5] transition-colors underline decoration-[#94A3B8] hover:decoration-[#4F46E5]"
                            title={event.ticket_url ? `Event page • Ticket: ${event.ticket_url}` : 'View event page'}
                          >
                            {event.title}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-[#475569]">
                          {getCategoryEmoji(event.category)} {getCategoryLabel(event.category)}
                        </td>
                        <td className="py-3 px-4 text-[#475569]">{event.city}</td>
                        <td className="py-3 px-4">{statusBadge(event.status, event)}</td>
                        <td className="py-3 px-4">{sourceBadge(event.source)}</td>
                        <td className="py-3 px-4 text-[#475569]">{event.publisher_name}</td>
                        <td className="py-3 px-4 text-[#94A3B8]">{event.date}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {event.status === 'published' && (
                              <button
                                onClick={() => handleUnpublish(event.id)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs text-[#F8FAFC] border border-[#4F46E5] hover:opacity-80 disabled:opacity-50 transition-colors"
                                style={{ backgroundColor: '#4F46E5' }}
                                title="Move back to pending queue"
                              >
                                {actionLoading === event.id ? '...' : 'Unpublish'}
                              </button>
                            )}
                            {event.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(event.id)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === event.id ? '...' : 'Approve'}
                              </button>
                            )}
                            {event.status === 'rejected' && (
                              <button
                                onClick={() => handleApprove(event.id)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === event.id ? '...' : 'Re-approve'}
                              </button>
                            )}
                            {event.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(event)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === event.id ? '...' : 'Reject'}
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(event)}
                              className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                              title="Edit event"
                            >
                              Edit
                            </button>
                            {(event as any).deleted_at ? (
                              <button
                                onClick={() => handleRestore(event.id)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                                title="Restore this soft-deleted event"
                              >
                                {actionLoading === event.id ? '...' : 'Restore'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDelete(event.id)}
                                disabled={actionLoading === event.id}
                                className="px-2 py-1 rounded text-xs bg-gray-50 text-[#475569] border border-gray-200 hover:bg-red-50 hover:text-red-800 hover:border-red-200 disabled:opacity-50 transition-colors"
                                title="Permanently delete this event"
                              >
                                {actionLoading === event.id ? '...' : '🗑'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Inline edit form for All Events tab */}
                      {editingEventId === event.id && (
                        <tr className="border-b border-[#E2E8F0]/50">
                          <td colSpan={9} className="p-4 bg-[#F8FAFC]">
                            <div className="space-y-3">
                              <div className="text-xs text-[#4F46E5] font-medium mb-2">Edit Event</div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2">
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Title</label>
                                  <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Category</label>
                                  <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    {CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Price</label>
                                  <select value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    <option value="Free">Free</option>
                                    <option value="Paid">Paid</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">City</label>
                                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Metro Region</label>
                                  <select value={editForm.metro_region} onChange={(e) => setEditForm({ ...editForm, metro_region: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none">
                                    <option value="">Select Metro</option>
                                    {METRO_AREAS.filter(m => m.key !== 'All Cities').map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">State</label>
                                  <input type="text" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Date</label>
                                  <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" style={{ colorScheme: 'light' }} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Venue</label>
                                  <input type="text" value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Time</label>
                                  <input type="text" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Language</label>
                                  <input type="text" value={editForm.language} onChange={(e) => setEditForm({ ...editForm, language: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Ticket URL</label>
                                  <input type="text" value={editForm.ticket_url} onChange={(e) => setEditForm({ ...editForm, ticket_url: e.target.value })} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Description</label>
                                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-3 py-1.5 rounded text-xs bg-white border border-[#E2E8F0] text-[#0F172A] focus:border-[#4F46E5] focus:outline-none resize-y" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => saveEdit(event.id)} disabled={actionLoading === event.id} className="px-4 py-1.5 rounded text-xs bg-[#4F46E5] text-[#F8FAFC] font-medium hover:opacity-90 disabled:opacity-50">
                                  {actionLoading === event.id ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button onClick={cancelEdit} className="px-4 py-1.5 rounded text-xs text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Publishers Tab */}
        {tab === 'users' && (
          <div>
            {/* Role filter */}
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { key: 'all', label: 'All Users' },
                { key: 'admin', label: 'Admins' },
                { key: 'publisher', label: 'Publishers' },
                { key: 'visitor', label: 'Visitors' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setUserRoleFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    userRoleFilter === f.key
                      ? 'bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/30'
                      : 'text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="text-xs text-[#475569] self-center ml-2">{publishers.length} users</span>
            </div>

            {publishers.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                <Users size={40} className="mx-auto text-[#475569] mb-3" />
                <p className="text-[#94A3B8] text-sm">No users found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publishers.map((pub) => (
                  <div key={pub.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-[#0F172A]">{pub.name || 'Unnamed'}</h3>
                          {/* Role badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            pub.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            pub.role === 'publisher' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-[#94A3B8]'
                          }`}>
                            {pub.role}
                          </span>
                          {pub.suspended && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-600">
                              Suspended
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                          <span>{pub.email}</span>
                          {pub.slug && <span>@{pub.slug}</span>}
                          <span>Joined {new Date(pub.joined_at).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {pub.event_count ?? 0} events
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        {/* Role changer */}
                        <select
                          value={pub.role}
                          onChange={(e) => handleChangeRole(pub.id, e.target.value)}
                          className="px-2 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] cursor-pointer focus:outline-none focus:border-[#4F46E5]"
                        >
                          <option value="visitor">Visitor</option>
                          <option value="publisher">Publisher</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Edit button */}
                        <button
                          onClick={() => editingUserId === pub.id ? setEditingUserId(null) : handleEditUser(pub)}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#4F46E5] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30 transition-colors"
                        >
                          {editingUserId === pub.id ? 'Cancel' : 'Edit'}
                        </button>

                        {/* Suspend/Reinstate */}
                        {pub.suspended ? (
                          <button
                            onClick={() => handleReinstate(pub.id)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(pub.id)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 transition-colors"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {editingUserId === pub.id && (
                      <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Name</label>
                            <input type="text" value={editUserForm.name} onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:outline-none focus:border-[#4F46E5]" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Email</label>
                            <input type="email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:outline-none focus:border-[#4F46E5]" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Slug</label>
                            <input type="text" value={editUserForm.slug} onChange={(e) => setEditUserForm({ ...editUserForm, slug: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:outline-none focus:border-[#4F46E5]" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Bio</label>
                            <input type="text" value={editUserForm.bio} onChange={(e) => setEditUserForm({ ...editUserForm, bio: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:outline-none focus:border-[#4F46E5]" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveUser(pub.id)} className="px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>
                            Save Changes
                          </button>
                          <button onClick={() => setEditingUserId(null)} className="px-4 py-1.5 rounded-lg text-xs text-[#94A3B8] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ API Keys Tab ═══════════ */}
        {tab === 'apikeys' && <ApiKeysPanel />}

        {/* ═══════════ Memberships Tab ═══════════ */}
        {tab === 'memberships' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center space-y-4">
            <Users size={40} className="mx-auto text-[#4F46E5]" />
            <h2
              className="text-xl font-bold text-[#0F172A]"
              style={{ fontFamily: 'Plus Jakarta Sans, serif' }}
            >
              Membership & Pass Management
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
              Manage membership tiers, season passes, and subscriber lists from the dedicated management pages.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="/dashboard/memberships"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] hover:bg-[#6B1919] transition-colors"
              >
                Manage Memberships
              </a>
              <a
                href="/dashboard/passes"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30 transition-colors"
              >
                Manage Season Passes
              </a>
            </div>
          </div>
        )}

        {/* Rejection Feedback Modal */}
        {rejectingEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-[calc(100vw-2rem)] md:max-w-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={20} className="text-red-700" />
                <h2
                  className="text-lg font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Plus Jakarta Sans, serif' }}
                >
                  Reject Event
                </h2>
              </div>
              <p className="text-sm text-[#475569] mb-1">
                Rejecting: <span className="text-[#0F172A] font-medium">{rejectingEvent.title}</span>
              </p>
              <p className="text-xs text-[#94A3B8] mb-4">
                by {rejectingEvent.publisher_name}
              </p>
              <label className="block text-sm text-[#475569] mb-1.5">
                Feedback for the publisher <span className="text-[#94A3B8]">(required)</span>
              </label>
              <textarea
                value={rejectionFeedback}
                onChange={(e) => setRejectionFeedback(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-red-500/50 transition-colors placeholder-[#94A3B8]"
                placeholder="Explain what needs to be fixed — e.g., missing details, wrong category, duplicate event..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRejectWithFeedback}
                  disabled={!rejectionFeedback.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <X size={14} />
                  Reject with Feedback
                </button>
                <button
                  onClick={() => { setRejectingEvent(null); setRejectionFeedback(''); }}
                  className="px-5 py-2.5 rounded-lg text-sm text-[#475569] border border-[#E2E8F0] hover:bg-[#E2E8F0]/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      
    </div>
  )
}

/* ─── API Keys Panel ─── */
function ApiKeysPanel() {
  const [keys, setKeys] = useState<{ id: string; label: string; created_at: string; status: string }[]>([])
  const [newKeyLabel, setNewKeyLabel] = useState('KhojAI Agent')
  const [generatedKey, setGeneratedKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchKeys = async () => {
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    })
    if (res.ok) {
      const data = await res.json()
      setKeys(data.keys || [])
    }
  }

  useEffect(() => { fetchKeys() }, [])

  const generateKey = async () => {
    setLoading(true)
    setGeneratedKey('')
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', label: newKeyLabel }),
    })
    if (res.ok) {
      const data = await res.json()
      setGeneratedKey(data.key)
      fetchKeys()
    }
    setLoading(false)
  }

  const revokeKey = async (id: string) => {
    await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', id }),
    })
    fetchKeys()
  }

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Generate new key */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
          Generate API Key
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#94A3B8] mb-1">Label</label>
            <input
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:outline-none focus:border-[#4F46E5]"
            />
          </div>
          <button
            onClick={generateKey}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
          >
            {loading ? 'Generating...' : 'Generate Key'}
          </button>
        </div>

        {generatedKey && (
          <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#4F46E5' }}>
              Copy this key now — it won&apos;t be shown again!
            </p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg text-xs break-all" style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                {generatedKey}
              </code>
              <button
                onClick={copyKey}
                className="px-4 py-2 rounded-lg text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: copied ? '#2D7A3A' : '#4F46E5', color: 'white' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing keys */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
          Active API Keys
        </h3>
        {keys.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No API keys generated yet.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div>
                  <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{k.label || 'Unnamed'}</span>
                  <span className="text-xs text-[#94A3B8] ml-3">Created {new Date(k.created_at).toLocaleDateString()}</span>
                  {k.status === 'revoked' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-600">Revoked</span>
                  )}
                  {k.status === 'active' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">Active</span>
                  )}
                </div>
                {k.status === 'active' && (
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="px-3 py-1 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
