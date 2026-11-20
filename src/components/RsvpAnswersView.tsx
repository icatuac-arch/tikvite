'use client'

import { useState, useEffect } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'

interface QnA {
  question_id: string
  question_text: string
  question_type: string
  answer_text: string
}

interface Props {
  eventId: string
  rsvpId: string
}

export default function RsvpAnswersView({ eventId, rsvpId }: Props) {
  const [items, setItems] = useState<QnA[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !rsvpId) return
    setLoading(true)
    setError(null)

    // Fetch questions and answers in parallel
    Promise.all([
      fetch(`/api/events/${eventId}/rsvp-questions`).then((r) => r.json()),
      fetch(`/api/rsvp-answers?rsvp_id=${encodeURIComponent(rsvpId)}&event_id=${encodeURIComponent(eventId)}`).then((r) => r.json()),
    ])
      .then(([qData, aData]) => {
        const questions: Array<{ id: string; question_text: string; question_type: string }> = qData.questions || []
        const answers: Array<{ question_id: string; answer_text: string }> = aData.answers || []
        const answerMap = new Map(answers.map((a) => [a.question_id, a.answer_text]))

        setItems(
          questions.map((q) => ({
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            answer_text: answerMap.get(q.id) ?? '',
          })),
        )
      })
      .catch(() => setError('Failed to load answers'))
      .finally(() => setLoading(false))
  }, [eventId, rsvpId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
        <Loader2 size={14} className="animate-spin" />
        Loading answers…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 py-2">{error}</p>
  }

  const answered = items.filter((i) => i.answer_text.trim())

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-2 italic">No custom questions for this event.</p>
    )
  }

  if (answered.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-2 italic">Attendee did not answer any custom questions.</p>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <MessageSquare size={14} className="text-indigo-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Custom Answers</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {answered.map((item, i) => (
            <tr
              key={item.question_id}
              className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
            >
              <td className="px-4 py-3 font-medium text-slate-700 w-1/2 align-top border-b border-slate-100 last:border-b-0">
                {item.question_text}
              </td>
              <td className="px-4 py-3 text-slate-600 align-top border-b border-slate-100 last:border-b-0">
                {item.question_type === 'multiselect'
                  ? item.answer_text
                      .split(',')
                      .filter(Boolean)
                      .map((v) => (
                        <span
                          key={v}
                          className="inline-block mr-1 mb-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700"
                        >
                          {v.trim()}
                        </span>
                      ))
                  : item.question_type === 'checkbox'
                  ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${item.answer_text === 'yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.answer_text === 'yes' ? 'Yes' : 'No'}
                    </span>
                  )
                  : item.answer_text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
