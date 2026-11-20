'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

interface RsvpQuestion {
  id: string
  question_text: string
  question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'number'
  options?: string[] | null
  is_required: boolean
  sort_order: number
}

interface Props {
  eventId: string
  onAnswersChange: (answers: Record<string, string>) => void
}

export default function RsvpCustomQuestions({ eventId, onAnswersChange }: Props) {
  const [questions, setQuestions] = useState<RsvpQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/events/${eventId}/rsvp-questions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setQuestions(d.questions || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eventId])

  const handleChange = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value }
        onAnswersChange(next)
        return next
      })
    },
    [onAnswersChange],
  )

  const handleBlur = (questionId: string) => {
    setTouched((prev) => ({ ...prev, [questionId]: true }))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
        <Loader2 size={14} className="animate-spin" />
        Loading questions…
      </div>
    )
  }

  if (questions.length === 0) return null

  return (
    <div className="space-y-5">
      {questions.map((q) => {
        const value = answers[q.id] ?? ''
        const hasError = touched[q.id] && q.is_required && !value.trim()
        const label = (
          <label
            htmlFor={`rsvp-q-${q.id}`}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {q.question_text}
            {q.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )

        return (
          <div key={q.id}>
            {label}
            {q.question_type === 'text' && (
              <input
                id={`rsvp-q-${q.id}`}
                type="text"
                value={value}
                onChange={(e) => handleChange(q.id, e.target.value)}
                onBlur={() => handleBlur(q.id)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  hasError ? 'border-red-400' : 'border-slate-200'
                }`}
              />
            )}
            {q.question_type === 'textarea' && (
              <textarea
                id={`rsvp-q-${q.id}`}
                value={value}
                rows={3}
                onChange={(e) => handleChange(q.id, e.target.value)}
                onBlur={() => handleBlur(q.id)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${
                  hasError ? 'border-red-400' : 'border-slate-200'
                }`}
              />
            )}
            {q.question_type === 'number' && (
              <input
                id={`rsvp-q-${q.id}`}
                type="number"
                value={value}
                onChange={(e) => handleChange(q.id, e.target.value)}
                onBlur={() => handleBlur(q.id)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  hasError ? 'border-red-400' : 'border-slate-200'
                }`}
              />
            )}
            {q.question_type === 'checkbox' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id={`rsvp-q-${q.id}`}
                  type="checkbox"
                  checked={value === 'yes'}
                  onChange={(e) => {
                    handleChange(q.id, e.target.checked ? 'yes' : 'no')
                    handleBlur(q.id)
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="text-sm text-slate-600">Yes</span>
              </label>
            )}
            {q.question_type === 'select' && (
              <select
                id={`rsvp-q-${q.id}`}
                value={value}
                onChange={(e) => {
                  handleChange(q.id, e.target.value)
                  handleBlur(q.id)
                }}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  hasError ? 'border-red-400' : 'border-slate-200'
                }`}
              >
                <option value="">Select an option…</option>
                {(q.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {q.question_type === 'multiselect' && (
              <div
                className={`rounded-lg border p-2 space-y-1 bg-white ${
                  hasError ? 'border-red-400' : 'border-slate-200'
                }`}
              >
                {(q.options || []).map((opt) => {
                  const selected = value.split(',').filter(Boolean)
                  const checked = selected.includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = checked
                            ? selected.filter((s) => s !== opt)
                            : [...selected, opt]
                          handleChange(q.id, next.join(','))
                          handleBlur(q.id)
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      <span className="text-sm text-slate-700">{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}
            {hasError && (
              <p className="mt-1 text-xs text-red-500">This field is required</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
