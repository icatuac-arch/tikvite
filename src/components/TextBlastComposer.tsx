'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Send, Loader2, Clock, Users, CheckCircle } from 'lucide-react'

interface Blast {
  id: string
  message: string
  segment: string
  recipient_count: number
  sent_count: number
  status: string
  created_at: string
}

const SEGMENTS = [
  { value: 'all', label: 'All Guests', icon: Users },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'waitlist', label: 'Waitlist', icon: Clock },
]

export default function TextBlastComposer({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState('')
  const [segment, setSegment] = useState('all')
  const [blasts, setBlasts] = useState<Blast[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/events/${eventId}/text-blast`)
      .then(r => r.json())
      .then(d => setBlasts(d.blasts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eventId])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/events/${eventId}/text-blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, segment }),
      })
      const data = await res.json()
      if (data.ok) {
        setBlasts(prev => [data.blast, ...prev])
        setMessage('')
      }
    } catch {}
    setSending(false)
  }

  const charCount = message.length
  const smsCount = Math.ceil(charCount / 160) || 1

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Text Blast</h3>
          <p className="text-xs text-gray-500">Send SMS to your guests</p>
        </div>
      </div>

      {/* Segment pills */}
      <div className="flex gap-2 mb-4">
        {SEGMENTS.map(s => (
          <button
            key={s.value}
            onClick={() => setSegment(s.value)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              segment === s.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Message */}
      <div className="relative">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-indigo-400 focus:bg-white resize-none"
        />
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <span>{charCount} chars · {smsCount} SMS{smsCount > 1 ? 's' : ''}</span>
          {charCount > 160 && (
            <span className="text-amber-500">Multiple SMS segments</span>
          )}
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={!message.trim() || sending}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send Text Blast
      </button>

      <p className="mt-2 text-xs text-gray-400 text-center">
        SMS delivery requires Twilio configuration
      </p>

      {/* History */}
      {blasts.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Past Blasts
          </h4>
          <div className="space-y-2">
            {blasts.map(b => (
              <div key={b.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="text-gray-700 line-clamp-2">{b.message}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span>{b.recipient_count} recipients</span>
                  <span>·</span>
                  <span className="capitalize">{b.segment}</span>
                  <span>·</span>
                  <span>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
