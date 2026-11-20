'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Calendar, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function QuickCreatePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = title.trim() && date

  const handleCreate = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/events/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), date, time, location: location.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      router.push(`/e/${data.short_id}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700 mb-4">
            <Sparkles className="h-4 w-4" />
            Quick Create
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Create an event in<br />
            <span className="text-indigo-600">30 seconds</span>
          </h1>
          <p className="mt-3 text-gray-500">
            Just the essentials. Add more details later.
          </p>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <input
              type="text"
              placeholder="What's the occasion?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-6 py-5 text-xl font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Date & Time */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border-2 border-gray-200 bg-white pl-14 pr-5 py-5 text-lg text-gray-900 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="w-40">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-5 text-lg text-gray-900 outline-none focus:border-indigo-500 transition-colors"
                placeholder="Time"
              />
            </div>
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Add a location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white pl-14 pr-5 py-5 text-lg text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Submit */}
          <motion.button
            whileHover={{ scale: canSubmit ? 1.02 : 1 }}
            whileTap={{ scale: canSubmit ? 0.98 : 1 }}
            onClick={handleCreate}
            disabled={!canSubmit || loading}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-bold transition-all ${
              canSubmit
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Create Event
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </motion.button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Need more options?{' '}
          <a href="/dashboard/create" className="text-indigo-600 font-medium hover:underline">
            Use the full event creator
          </a>
        </p>
      </motion.div>
    </div>
  )
}
