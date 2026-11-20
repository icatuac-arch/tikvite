'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Shield, QrCode, Eye, Loader2 } from 'lucide-react'

interface TeamMember {
  id: string
  user_email: string
  user_id: string | null
  role: 'organizer' | 'checkin' | 'viewer'
  accepted: boolean
  created_at: string
}

const ROLE_CONFIG = {
  organizer: { label: 'Organizer', desc: 'Full event management', icon: Shield, color: '#4F46E5' },
  checkin: { label: 'Check-in Staff', desc: 'Scan tickets at the door', icon: QrCode, color: '#7C3AED' },
  viewer: { label: 'Viewer', desc: 'View analytics only', icon: Eye, color: '#475569' },
}

export default function TeamManager({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'organizer' | 'checkin' | 'viewer'>('checkin')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const fetchTeam = async () => {
    const resp = await fetch(`/api/events/${eventId}/team`)
    const data = await resp.json()
    if (data.ok) setMembers(data.members)
    setLoading(false)
  }

  useEffect(() => { fetchTeam() }, [eventId])

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return
    setAdding(true)

    const resp = await fetch(`/api/events/${eventId}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await resp.json()
    if (!data.ok) {
      setError(data.error || 'Failed to add')
    } else {
      setEmail('')
      fetchTeam()
    }
    setAdding(false)
  }

  const removeMember = async (memberId: string) => {
    setRemoving(memberId)
    await fetch(`/api/events/${eventId}/team?member_id=${memberId}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setRemoving(null)
  }

  if (loading) {
    return <div className="text-sm" style={{ color: '#94A3B8' }}>Loading team...</div>
  }

  return (
    <div className="space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Add member form */}
      <form onSubmit={addMember} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="team@example.com"
          className="flex-1 px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
          onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="px-3 py-2.5 rounded-lg border text-sm focus:outline-none"
          style={{ borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#fff' }}
        >
          <option value="checkin">Check-in Staff</option>
          <option value="organizer">Organizer</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="submit"
          disabled={adding || !email.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Add
        </button>
      </form>

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFF0F0', color: '#991B1B', border: '1px solid #FECDD3' }}>
          {error}
        </div>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="text-sm py-4 text-center rounded-lg" style={{ color: '#94A3B8', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          No team members yet. Add someone above to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const cfg = ROLE_CONFIG[m.role]
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border"
                style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#F8FAFC' }}
                  >
                    <cfg.icon size={14} style={{ color: cfg.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>
                      {m.user_email}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: '#94A3B8' }}>
                      <span
                        className="px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#F8FAFC', color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      {!m.accepted && (
                        <span style={{ color: '#7C3AED' }}>Pending</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeMember(m.id)}
                  disabled={removing === m.id}
                  className="p-2 rounded-lg transition-colors hover:bg-red-50 flex-shrink-0 disabled:opacity-50"
                  title="Remove"
                >
                  {removing === m.id ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#94A3B8' }} />
                  ) : (
                    <Trash2 size={14} style={{ color: '#94A3B8' }} />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
