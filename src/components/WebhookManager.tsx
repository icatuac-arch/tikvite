'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, Globe, Copy, Check } from 'lucide-react'

interface Webhook {
  id: string
  url: string
  events: string[]
  is_active: boolean
  created_at: string
}

interface Delivery {
  id: string
  webhook_id: string
  event_type: string
  response_status: number | null
  success: boolean
  delivered_at: string
}

const ALL_EVENT_TYPES = [
  { value: 'ticket.created', label: 'Ticket Created' },
  { value: 'ticket.checked_in', label: 'Ticket Checked In' },
  { value: 'ticket.transferred', label: 'Ticket Transferred' },
  { value: 'ticket.cancelled', label: 'Ticket Cancelled' },
  { value: 'order.paid', label: 'Order Paid' },
  { value: 'rsvp.created', label: 'RSVP Created' },
]

export default function WebhookManager({ eventId }: { eventId: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`/api/organizer/webhooks?event_id=${eventId}`)
      const data = await res.json()
      if (data.ok) {
        setWebhooks(data.webhooks)
        setDeliveries(data.deliveries)
      }
    } catch {
      // silent
    }
    setLoading(false)
  }

  useEffect(() => { fetchWebhooks() }, [eventId])

  const handleCreate = async () => {
    setError('')
    if (!url) { setError('Please enter a URL'); return }
    if (!selectedEvents.length) { setError('Select at least one event type'); return }
    setSaving(true)

    try {
      const res = await fetch('/api/organizer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, url, events: selectedEvents }),
      })
      const data = await res.json()
      if (data.ok) {
        setNewSecret(data.webhook.secret)
        setShowForm(false)
        setUrl('')
        setSelectedEvents([])
        fetchWebhooks()
      } else {
        setError(data.error || 'Failed to create webhook')
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    await fetch(`/api/organizer/webhooks?id=${id}`, { method: 'DELETE' })
    fetchWebhooks()
  }

  const toggleEvent = (val: string) => {
    setSelectedEvents((prev) =>
      prev.includes(val) ? prev.filter((e) => e !== val) : [...prev, val]
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
        Loading webhooks...
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Secret display after creation */}
      {newSecret && (
        <div
          style={{
            background: '#D1FAE5',
            border: '1px solid #A5D6A7',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32', marginBottom: 8 }}>
            Webhook Created! Save your signing secret (shown only once):
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#fff',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'ui-monospace, monospace',
                color: '#333',
                wordBreak: 'break-all',
              }}
            >
              {newSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newSecret)
                setCopiedSecret(true)
                setTimeout(() => setCopiedSecret(false), 2000)
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#2E7D32',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
              }}
            >
              {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
              {copiedSecret ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewSecret(null)}
            style={{
              marginTop: 10,
              fontSize: 12,
              color: '#475569',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
          <Globe size={16} style={{ verticalAlign: 'middle', marginRight: 8, color: '#4F46E5' }} />
          Webhooks
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            background: '#4F46E5',
            color: '#F8FAFC',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Plus size={14} />
          Add Webhook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          {error && (
            <div style={{ color: '#C62828', fontSize: 13, marginBottom: 12, background: '#FFF0F0', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 500 }}>
              Endpoint URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 500 }}>
              Event Types
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_EVENT_TYPES.map((et) => (
                <button
                  key={et.value}
                  type="button"
                  onClick={() => toggleEvent(et.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${selectedEvents.includes(et.value) ? '#4F46E5' : '#E2E8F0'}`,
                    background: selectedEvents.includes(et.value) ? '#4F46E5' : '#fff',
                    color: selectedEvents.includes(et.value) ? '#F8FAFC' : '#475569',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: '#4F46E5',
                color: '#F8FAFC',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Creating...' : 'Create Webhook'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: 'transparent',
                color: '#475569',
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Webhook list */}
      {webhooks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: '#94A3B8',
            fontSize: 14,
            background: '#F8FAFC',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          No webhooks configured. Add one to receive real-time event notifications.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {webhooks.map((wh) => {
            const whDeliveries = deliveries.filter((d) => d.webhook_id === wh.id)
            return (
              <div
                key={wh.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0F172A',
                        wordBreak: 'break-all',
                        marginBottom: 6,
                      }}
                    >
                      {wh.url}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {wh.events.map((e) => (
                        <span
                          key={e}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            fontSize: 11,
                            color: '#475569',
                          }}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid #FFCDD2',
                      color: '#C62828',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title="Delete webhook"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Recent deliveries */}
                {whDeliveries.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Deliveries
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {whDeliveries.slice(0, 5).map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            color: '#475569',
                          }}
                        >
                          {d.success ? (
                            <CheckCircle size={12} style={{ color: '#2E7D32', flexShrink: 0 }} />
                          ) : (
                            <XCircle size={12} style={{ color: '#C62828', flexShrink: 0 }} />
                          )}
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{d.event_type}</span>
                          <span style={{ color: '#94A3B8' }}>
                            {d.response_status || 'err'}
                          </span>
                          <span style={{ color: '#94A3B8', marginLeft: 'auto', fontSize: 11 }}>
                            {new Date(d.delivered_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
