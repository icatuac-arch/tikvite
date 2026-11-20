'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Send, Clock, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Update {
  id: string
  title: string
  message: string
  created_at: string
}

interface Props {
  eventId: string
}

export default function EventUpdates({ eventId }: Props) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [notifyAttendees, setNotifyAttendees] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState(true)

  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/updates`)
      const data = await res.json()
      if (data.ok) setUpdates(data.updates || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchUpdates() }, [fetchUpdates])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required')
      return
    }
    setPosting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/events/${eventId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          notify_attendees: notifyAttendees,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Failed to post update')
      } else {
        setSuccess(
          notifyAttendees
            ? 'Update posted and attendees are being notified!'
            : 'Update posted successfully!'
        )
        setTitle('')
        setMessage('')
        setNotifyAttendees(false)
        fetchUpdates()
        setTimeout(() => setSuccess(''), 5000)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setPosting(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #E2E8F0',
    background: '#FDFAF5',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    color: '#334155',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div>
      {/* Post new update form */}
      <form onSubmit={handlePost} style={{ marginBottom: updates.length ? 28 : 0 }}>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#4F46E5',
              marginBottom: 5,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Update Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Parking Update, Schedule Change..."
            maxLength={200}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#4F46E5')}
            onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#4F46E5',
              marginBottom: 5,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your update message here..."
            maxLength={5000}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
            onFocus={(e) => (e.target.style.borderColor = '#4F46E5')}
            onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#334155',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <input
              type="checkbox"
              checked={notifyAttendees}
              onChange={(e) => setNotifyAttendees(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: '#4F46E5',
                cursor: 'pointer',
              }}
            />
            <span>
              Email all attendees about this update
            </span>
          </label>
          {notifyAttendees && (
            <div
              style={{
                marginTop: 6,
                marginLeft: 24,
                fontSize: 12,
                color: '#94A3B8',
                lineHeight: 1.4,
              }}
            >
              All confirmed and pending RSVPs will receive an email notification.
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#FFF5F5',
              border: '1px solid #FED7D7',
              color: '#C62828',
              fontSize: 13,
              marginBottom: 14,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#F1F8E9',
              border: '1px solid #D1FAE5',
              color: '#2E7D32',
              fontSize: 13,
              marginBottom: 14,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <CheckCircle size={14} /> {success}
          </div>
        )}

        <button
          type="submit"
          disabled={posting || !title.trim() || !message.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: posting || !title.trim() || !message.trim() ? '#D4C5B0' : '#4F46E5',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: posting || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <Send size={14} />
          {posting ? 'Posting...' : 'Post Update'}
        </button>
      </form>

      {/* Existing updates list */}
      {updates.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#4F46E5',
              fontFamily: 'Plus Jakarta Sans, serif',
              marginBottom: expanded ? 14 : 0,
              padding: 0,
            }}
          >
            <Megaphone size={16} />
            Previous Updates ({updates.length})
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {updates.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#4F46E5',
                      marginBottom: 4,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {u.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#334155',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {u.message}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 8,
                      fontSize: 11,
                      color: '#94A3B8',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Clock size={11} />
                    {formatDate(u.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          Loading updates...
        </div>
      )}

      {!loading && updates.length === 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: '#94A3B8',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          No updates posted yet. Updates you post here will appear on every attendee's ticket page.
        </div>
      )}
    </div>
  )
}
