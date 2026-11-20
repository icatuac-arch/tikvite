'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Users, Crown, ChevronDown, ChevronUp, X, UserPlus } from 'lucide-react'

interface Membership {
  id: string
  name: string
  description: string
  price: number
  benefits: {
    discount_percent?: number
    early_access_days?: number
    free_events?: boolean
  }
  max_members: number | null
  is_active: boolean
  subscriber_count: number
  total_subscribers: number
  created_at: string
}

interface Subscriber {
  id: string
  membership_id: string
  user_email: string
  user_name: string
  status: 'active' | 'expired' | 'cancelled'
  started_at: string
  expires_at: string | null
}

export default function MembershipsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [maxMembers, setMaxMembers] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [earlyAccessDays, setEarlyAccessDays] = useState('')
  const [freeEvents, setFreeEvents] = useState(false)

  // Add subscriber form
  const [showAddSub, setShowAddSub] = useState(false)
  const [subName, setSubName] = useState('')
  const [subEmail, setSubEmail] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/'); return }
      await fetchMemberships()
      setLoading(false)
    }
    init()
  }, [])

  const fetchMemberships = async () => {
    const resp = await fetch('/api/memberships')
    const data = await resp.json()
    if (data.ok) setMemberships(data.memberships)
  }

  const fetchSubscribers = async (membershipId: string) => {
    setLoadingSubs(true)
    const resp = await fetch('/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_subscribers', membership_id: membershipId }),
    })
    const data = await resp.json()
    if (data.ok) setSubscribers(data.subscribers)
    setLoadingSubs(false)
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setSubscribers([])
    } else {
      setExpandedId(id)
      await fetchSubscribers(id)
    }
  }

  const saveMembership = async () => {
    setError(null)
    setSaving(true)
    const benefits: any = {}
    if (discountPercent) benefits.discount_percent = parseInt(discountPercent)
    if (earlyAccessDays) benefits.early_access_days = parseInt(earlyAccessDays)
    if (freeEvents) benefits.free_events = true

    const resp = await fetch('/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_membership',
        id: editingId || undefined,
        name,
        description,
        price: parseFloat(price) || 0,
        max_members: maxMembers ? parseInt(maxMembers) : null,
        benefits,
      }),
    })
    const data = await resp.json()
    if (!data.ok) {
      setError(data.error)
    } else {
      setShowForm(false)
      resetForm()
      await fetchMemberships()
    }
    setSaving(false)
  }

  const deactivate = async (id: string) => {
    await fetch(`/api/memberships?id=${id}`, { method: 'DELETE' })
    await fetchMemberships()
  }

  const addSubscriber = async (membershipId: string) => {
    if (!subName.trim() || !subEmail.trim()) return
    const resp = await fetch('/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_subscriber',
        membership_id: membershipId,
        user_name: subName,
        user_email: subEmail,
      }),
    })
    const data = await resp.json()
    if (data.ok) {
      setShowAddSub(false)
      setSubName('')
      setSubEmail('')
      await fetchSubscribers(membershipId)
      await fetchMemberships()
    }
  }

  const updateSubStatus = async (subId: string, status: string, membershipId: string) => {
    await fetch('/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_subscriber', subscription_id: subId, status }),
    })
    await fetchSubscribers(membershipId)
    await fetchMemberships()
  }

  const startEdit = (m: Membership) => {
    setEditingId(m.id)
    setName(m.name)
    setDescription(m.description || '')
    setPrice(String(m.price))
    setMaxMembers(m.max_members ? String(m.max_members) : '')
    setDiscountPercent(m.benefits?.discount_percent ? String(m.benefits.discount_percent) : '')
    setEarlyAccessDays(m.benefits?.early_access_days ? String(m.benefits.early_access_days) : '')
    setFreeEvents(!!m.benefits?.free_events)
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setPrice('')
    setMaxMembers('')
    setDiscountPercent('')
    setEarlyAccessDays('')
    setFreeEvents(false)
    setError(null)
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
            <Crown size={28} className="text-[#4F46E5]" />
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
            >
              Memberships
            </h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] hover:opacity-90 transition-colors"
          >
            <Plus size={16} />
            {showForm ? 'Cancel' : 'Create Tier'}
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 mb-8 space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]" style={{ fontFamily: 'Plus Jakarta Sans, serif' }}>
              {editingId ? 'Edit Membership Tier' : 'New Membership Tier'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Gold Member" />
              </div>
              <div>
                <label className={labelClass}>Annual fee ($)</label>
                <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={inputClass} placeholder="0 = free" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClass} placeholder="What does this tier include?" />
            </div>

            <div className="text-xs uppercase tracking-wider text-[#94A3B8] mt-2">Benefits</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Discount on events (%)</label>
                <input type="number" min={0} max={100} value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className={inputClass} placeholder="e.g. 10" />
              </div>
              <div>
                <label className={labelClass}>Early access (days)</label>
                <input type="number" min={0} value={earlyAccessDays} onChange={e => setEarlyAccessDays(e.target.value)} className={inputClass} placeholder="e.g. 3" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={freeEvents} onChange={e => setFreeEvents(e.target.checked)} className="accent-[#4F46E5]" />
                  <span className="text-sm text-[#334155]">Free event access</span>
                </label>
              </div>
            </div>

            <div>
              <label className={labelClass}>Max members (blank = unlimited)</label>
              <input type="number" min={1} value={maxMembers} onChange={e => setMaxMembers(e.target.value)} className={inputClass} placeholder="Unlimited" />
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <div className="flex gap-3">
              <button
                onClick={saveMembership}
                disabled={saving || !name.trim()}
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

        {memberships.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-12 text-center">
            <Crown size={40} className="mx-auto text-[#94A3B8] mb-3" />
            <p className="text-[#94A3B8] text-sm">No membership tiers yet. Create one to offer exclusive benefits.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {memberships.map(m => (
              <div key={m.id} className={`rounded-xl border ${m.is_active ? 'border-[#E2E8F0]' : 'border-red-900/30 opacity-60'} bg-[#FFFFFF]`}>
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown size={16} className="text-[#4F46E5]" />
                      <h3 className="font-semibold text-[#0F172A]">{m.name}</h3>
                      <span className="text-xs text-[#475569]">
                        ${Number(m.price).toFixed(2)}/yr
                      </span>
                      {!m.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                          Inactive
                        </span>
                      )}
                    </div>
                    {m.description && <p className="text-xs text-[#475569] mb-2">{m.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {m.subscriber_count} active{m.max_members ? ` / ${m.max_members} max` : ''}
                      </span>
                      {m.benefits?.discount_percent && (
                        <span>{m.benefits.discount_percent}% discount</span>
                      )}
                      {m.benefits?.early_access_days && (
                        <span>{m.benefits.early_access_days}-day early access</span>
                      )}
                      {m.benefits?.free_events && (
                        <span>Free events</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(m.id)}
                      className="p-2 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#CBD5E1]/40 transition-colors"
                      title="View members"
                    >
                      {expandedId === m.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => startEdit(m)}
                      className="p-2 rounded-lg text-[#475569] hover:text-[#4F46E5] hover:bg-[#CBD5E1]/40 transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {m.is_active && (
                      <button
                        onClick={() => deactivate(m.id)}
                        className="p-2 rounded-lg text-[#475569] hover:text-red-400 hover:bg-[#CBD5E1]/40 transition-colors"
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === m.id && (
                  <div className="border-t border-[#E2E8F0] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-[#94A3B8]">Members</span>
                      <button
                        onClick={() => setShowAddSub(!showAddSub)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F8FAFC] bg-[#4F46E5] hover:opacity-90 transition-colors"
                      >
                        <UserPlus size={12} />
                        Add Member
                      </button>
                    </div>

                    {showAddSub && (
                      <div className="flex items-end gap-2 p-3 rounded-lg bg-[#0A0816] border border-[#E2E8F0]">
                        <div className="flex-1">
                          <label className={labelClass}>Name</label>
                          <input value={subName} onChange={e => setSubName(e.target.value)} className={inputClass} placeholder="Full name" />
                        </div>
                        <div className="flex-1">
                          <label className={labelClass}>Email</label>
                          <input type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)} className={inputClass} placeholder="email@example.com" />
                        </div>
                        <button
                          onClick={() => addSubscriber(m.id)}
                          disabled={!subName.trim() || !subEmail.trim()}
                          className="px-3 py-2 rounded-lg text-xs font-semibold text-[#F8FAFC] bg-[#4F46E5] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}

                    {loadingSubs ? (
                      <div className="text-xs text-[#94A3B8] text-center py-4">Loading...</div>
                    ) : subscribers.length === 0 ? (
                      <div className="text-xs text-[#94A3B8] text-center py-4 italic">No members yet</div>
                    ) : (
                      <div className="space-y-1">
                        {subscribers.map(s => (
                          <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0A0816]">
                            <div>
                              <span className="text-sm text-[#0F172A]">{s.user_name}</span>
                              <span className="text-xs text-[#94A3B8] ml-2">{s.user_email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                s.status === 'expired' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {s.status}
                              </span>
                              {s.status === 'active' && (
                                <button
                                  onClick={() => updateSubStatus(s.id, 'cancelled', m.id)}
                                  className="text-xs text-[#94A3B8] hover:text-red-400 transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                              {s.status === 'cancelled' && (
                                <button
                                  onClick={() => updateSubStatus(s.id, 'active', m.id)}
                                  className="text-xs text-[#94A3B8] hover:text-green-400 transition-colors"
                                >
                                  Reactivate
                                </button>
                              )}
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
