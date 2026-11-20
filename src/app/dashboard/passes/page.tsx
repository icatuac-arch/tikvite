'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Ticket, ChevronDown, ChevronUp, Calendar, DollarSign } from 'lucide-react'

interface EventPass {
  id: string
  name: string
  description: string
  price: number
  event_ids: string[]
  event_titles: string[]
  max_sold: number | null
  sold_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  holder_count: number
  total_holders: number
  created_at: string
}

interface PassHolder {
  id: string
  pass_id: string
  holder_name: string
  holder_email: string
  status: string
  purchased_at: string
}

interface EventOption {
  id: string
  title: string
  date: string
}

export default function PassesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [passes, setPasses] = useState<EventPass[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [holders, setHolders] = useState<PassHolder[]>([])
  const [loadingHolders, setLoadingHolders] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [maxSold, setMaxSold] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/'); return }

      // Fetch published events for the selector
      const { data: evts } = await supabase
        .from('events')
        .select('id, title, date')
        .eq('status', 'published')
        .order('date', { ascending: true })
      setEvents(evts || [])

      await fetchPasses()
      setLoading(false)
    }
    init()
  }, [])

  const fetchPasses = async () => {
    const resp = await fetch('/api/passes?all=1')
    const data = await resp.json()
    if (data.ok) setPasses(data.passes)
  }

  const fetchHolders = async (passId: string) => {
    setLoadingHolders(true)
    const resp = await fetch('/api/passes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_holders', pass_id: passId }),
    })
    const data = await resp.json()
    if (data.ok) setHolders(data.holders)
    setLoadingHolders(false)
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setHolders([])
    } else {
      setExpandedId(id)
      await fetchHolders(id)
    }
  }

  const savePass = async () => {
    setError(null)
    setSaving(true)
    const resp = await fetch('/api/passes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: editingId ? 'update_pass' : 'create_pass',
        id: editingId || undefined,
        name,
        description,
        price: parseFloat(price) || 0,
        event_ids: selectedEventIds,
        max_sold: maxSold ? parseInt(maxSold) : null,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
      }),
    })
    const data = await resp.json()
    if (!data.ok) {
      setError(data.error)
    } else {
      setShowForm(false)
      resetForm()
      await fetchPasses()
    }
    setSaving(false)
  }

  const deactivate = async (id: string) => {
    await fetch(`/api/passes?id=${id}`, { method: 'DELETE' })
    await fetchPasses()
  }

  const startEdit = (p: EventPass) => {
    setEditingId(p.id)
    setName(p.name)
    setDescription(p.description || '')
    setPrice(String(p.price))
    setMaxSold(p.max_sold ? String(p.max_sold) : '')
    setValidFrom(p.valid_from ? p.valid_from.slice(0, 16) : '')
    setValidUntil(p.valid_until ? p.valid_until.slice(0, 16) : '')
    setSelectedEventIds(p.event_ids || [])
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setPrice('')
    setMaxSold('')
    setValidFrom('')
    setValidUntil('')
    setSelectedEventIds([])
    setError(null)
  }

  const toggleEvent = (eid: string) => {
    setSelectedEventIds(prev =>
      prev.includes(eid) ? prev.filter(id => id !== eid) : [...prev, eid]
    )
  }

  // Calculate individual total for savings display
  const calcIndividualTotal = () => {
    // This would need tier prices; for now just show event count
    return selectedEventIds.length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#4F46E5]" />
      </div>
    )
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-[#4F46E5] transition-colors'
  const labelClass = 'block text-xs text-[#475569] mb-1.5'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Ticket size={28} className="text-[#4F46E5]" />
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
            >
              Season Passes
            </h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] hover:opacity-90 transition-colors"
          >
            <Plus size={16} />
            {showForm ? 'Cancel' : 'Create Pass'}
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 mb-8 space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]" style={{ fontFamily: 'Plus Jakarta Sans, serif' }}>
              {editingId ? 'Edit Pass' : 'New Season Pass'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Navratri Season Pass" />
              </div>
              <div>
                <label className={labelClass}>Price ($) *</label>
                <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={inputClass} placeholder="49.99" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClass} placeholder="What events does this pass include?" />
            </div>

            <div>
              <label className={labelClass}>Select events to include *</label>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#0A0816] p-3 space-y-1">
                {events.length === 0 ? (
                  <div className="text-xs text-[#94A3B8] text-center py-4">No published events available</div>
                ) : (
                  events.map(evt => (
                    <label key={evt.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#CBD5E1]/40 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedEventIds.includes(evt.id)}
                        onChange={() => toggleEvent(evt.id)}
                        className="accent-[#4F46E5]"
                      />
                      <span className="text-sm text-[#334155] flex-1">{evt.title}</span>
                      <span className="text-xs text-[#94A3B8]">{evt.date}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedEventIds.length > 0 && (
                <div className="mt-1 text-xs text-[#475569]">
                  {selectedEventIds.length} event{selectedEventIds.length > 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Max passes to sell</label>
                <input type="number" min={1} value={maxSold} onChange={e => setMaxSold(e.target.value)} className={inputClass} placeholder="Unlimited" />
              </div>
              <div>
                <label className={labelClass}>Available from</label>
                <input type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Available until</label>
                <input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputClass} />
              </div>
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <div className="flex gap-3">
              <button
                onClick={savePass}
                disabled={saving || !name.trim() || selectedEventIds.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] disabled:opacity-50 hover:opacity-90 transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 rounded-lg text-sm text-[#475569] border border-[#E2E8F0] hover:bg-[#CBD5E1]/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {passes.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-12 text-center">
            <Ticket size={40} className="mx-auto text-[#94A3B8] mb-3" />
            <p className="text-[#94A3B8] text-sm">No season passes yet. Bundle events together to offer savings.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {passes.map(p => (
              <div key={p.id} className={`rounded-xl border ${p.is_active ? 'border-[#E2E8F0]' : 'border-red-900/30 opacity-60'} bg-[#FFFFFF]`}>
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Ticket size={16} className="text-[#4F46E5]" />
                      <h3 className="font-semibold text-[#0F172A]">{p.name}</h3>
                      <span className="text-sm font-semibold text-[#4F46E5]">
                        ${Number(p.price).toFixed(2)}
                      </span>
                      {!p.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                          Inactive
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-[#475569] mb-2">{p.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {p.event_titles.map((title, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                          {title}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} />
                        {p.sold_count} sold{p.max_sold ? ` / ${p.max_sold}` : ''}
                      </span>
                      {p.valid_until && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Until {new Date(p.valid_until).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className="p-2 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#CBD5E1]/40 transition-colors"
                      title="View holders"
                    >
                      {expandedId === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="p-2 rounded-lg text-[#475569] hover:text-[#4F46E5] hover:bg-[#CBD5E1]/40 transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {p.is_active && (
                      <button
                        onClick={() => deactivate(p.id)}
                        className="p-2 rounded-lg text-[#475569] hover:text-red-400 hover:bg-[#CBD5E1]/40 transition-colors"
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="border-t border-[#E2E8F0] p-5 space-y-3">
                    <span className="text-xs uppercase tracking-wider text-[#94A3B8]">Pass Holders</span>
                    {loadingHolders ? (
                      <div className="text-xs text-[#94A3B8] text-center py-4">Loading...</div>
                    ) : holders.length === 0 ? (
                      <div className="text-xs text-[#94A3B8] text-center py-4 italic">No holders yet</div>
                    ) : (
                      <div className="space-y-1">
                        {holders.map(h => (
                          <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0A0816]">
                            <div>
                              <span className="text-sm text-[#0F172A]">{h.holder_name}</span>
                              <span className="text-xs text-[#94A3B8] ml-2">{h.holder_email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                h.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                'bg-gray-500/20 text-[#475569] border border-gray-500/30'
                              }`}>
                                {h.status}
                              </span>
                              <span className="text-xs text-[#94A3B8]">
                                {new Date(h.purchased_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      
    </div>
  )
}
