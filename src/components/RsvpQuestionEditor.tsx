'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  X,
  CheckSquare,
  Zap,
  Loader2,
} from 'lucide-react'

interface RsvpQuestion {
  id?: string
  question_text: string
  question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'number'
  options?: string[] | null
  is_required: boolean
  sort_order: number
}

const QUESTION_TYPES: { value: RsvpQuestion['question_type']; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown (single)' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox (yes/no)' },
  { value: 'number', label: 'Number' },
]

const PRESET_TEMPLATES: Array<{ label: string; question: Omit<RsvpQuestion, 'sort_order' | 'id'> }> = [
  {
    label: 'Dietary restrictions',
    question: {
      question_text: 'Do you have any dietary restrictions?',
      question_type: 'select',
      options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Kosher', 'Other'],
      is_required: false,
    },
  },
  {
    label: 'Song request',
    question: {
      question_text: 'Any song requests for the DJ?',
      question_type: 'text',
      options: null,
      is_required: false,
    },
  },
  {
    label: 'How did you hear about us?',
    question: {
      question_text: 'How did you hear about this event?',
      question_type: 'select',
      options: ['Instagram', 'Facebook', 'Word of mouth', 'Email newsletter', 'Google', 'Other'],
      is_required: false,
    },
  },
  {
    label: '+1 name',
    question: {
      question_text: "What is your +1's name?",
      question_type: 'text',
      options: null,
      is_required: false,
    },
  },
  {
    label: 'Social media handle',
    question: {
      question_text: 'What is your Instagram handle?',
      question_type: 'text',
      options: null,
      is_required: false,
    },
  },
  {
    label: 'T-shirt size',
    question: {
      question_text: 'What is your T-shirt size?',
      question_type: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      is_required: false,
    },
  },
]

function needsOptions(type: RsvpQuestion['question_type']) {
  return type === 'select' || type === 'multiselect'
}

interface Props {
  eventId: string
}

export default function RsvpQuestionEditor({ eventId }: Props) {
  const [questions, setQuestions] = useState<RsvpQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const showToast = useCallback((text: string, ok = true) => {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/events/${eventId}/rsvp-questions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setQuestions(d.questions || [])
      })
      .catch(() => showToast('Failed to load questions', false))
      .finally(() => setLoading(false))
  }, [eventId, showToast])

  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      {
        question_text: '',
        question_type: 'text',
        options: null,
        is_required: false,
        sort_order: qs.length,
      },
    ])
  }

  const addPreset = (preset: (typeof PRESET_TEMPLATES)[0]) => {
    setQuestions((qs) => [
      ...qs,
      { ...preset.question, sort_order: qs.length },
    ])
    setShowPresets(false)
  }

  const updateQuestion = (index: number, patch: Partial<RsvpQuestion>) => {
    setQuestions((qs) => {
      const copy = [...qs]
      copy[index] = { ...copy[index], ...patch }
      // If type changed away from options-requiring type, clear options
      if (patch.question_type && !needsOptions(patch.question_type)) {
        copy[index].options = null
      }
      // If type changed to options type, init empty options
      if (patch.question_type && needsOptions(patch.question_type) && !copy[index].options?.length) {
        copy[index].options = ['']
      }
      return copy
    })
  }

  const removeQuestion = (index: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== index).map((q, i) => ({ ...q, sort_order: i })))
  }

  const addOption = (index: number) => {
    setQuestions((qs) => {
      const copy = [...qs]
      copy[index] = { ...copy[index], options: [...(copy[index].options || []), ''] }
      return copy
    })
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((qs) => {
      const copy = [...qs]
      const opts = [...(copy[qIndex].options || [])]
      opts[oIndex] = value
      copy[qIndex] = { ...copy[qIndex], options: opts }
      return copy
    })
  }

  const removeOption = (qIndex: number, oIndex: number) => {
    setQuestions((qs) => {
      const copy = [...qs]
      const opts = (copy[qIndex].options || []).filter((_, i) => i !== oIndex)
      copy[qIndex] = { ...copy[qIndex], options: opts }
      return copy
    })
  }

  // Drag-and-drop reorder
  const handleDragStart = (index: number) => setDragging(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOver(index)
  }
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (dragging === null || dragging === dropIndex) {
      setDragging(null)
      setDragOver(null)
      return
    }
    setQuestions((qs) => {
      const copy = [...qs]
      const [moved] = copy.splice(dragging, 1)
      copy.splice(dropIndex, 0, moved)
      return copy.map((q, i) => ({ ...q, sort_order: i }))
    })
    setDragging(null)
    setDragOver(null)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questions.map((q, i) => ({ ...q, sort_order: i })),
        }),
      })
      const d = await res.json()
      if (d.ok) {
        setQuestions(d.questions || questions)
        showToast('Questions saved')
      } else {
        showToast(d.message || 'Failed to save', false)
      }
    } catch {
      showToast('Network error', false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading questions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Question list */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400 text-sm">
          No custom questions yet. Add one below or pick a template.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              className={`bg-white rounded-xl border p-4 transition-shadow ${
                dragOver === index ? 'border-indigo-400 shadow-md' : 'border-slate-200'
              } ${dragging === index ? 'opacity-50' : ''}`}
            >
              {/* Row 1: drag + text + delete */}
              <div className="flex items-start gap-2">
                <div className="cursor-grab mt-2 text-slate-300 hover:text-slate-500 flex-shrink-0">
                  <GripVertical size={16} />
                </div>
                <input
                  type="text"
                  value={q.question_text}
                  onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                  placeholder="Question text…"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <button
                  onClick={() => removeQuestion(index)}
                  className="mt-1.5 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Remove question"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Row 2: type + required */}
              <div className="mt-3 flex items-center gap-3 flex-wrap pl-6">
                <div className="relative">
                  <select
                    value={q.question_type}
                    onChange={(e) =>
                      updateQuestion(index, { question_type: e.target.value as RsvpQuestion['question_type'] })
                    }
                    className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <div
                    onClick={() => updateQuestion(index, { is_required: !q.is_required })}
                    className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${
                      q.is_required ? 'bg-indigo-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        q.is_required ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">Required</span>
                </label>
              </div>

              {/* Options editor */}
              {needsOptions(q.question_type) && (
                <div className="mt-3 pl-6 space-y-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Options</p>
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(index, oIdx, e.target.value)}
                        placeholder={`Option ${oIdx + 1}`}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <button
                        onClick={() => removeOption(index, oIdx)}
                        className="p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(index)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add option
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={addQuestion}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
        >
          <Plus size={15} />
          Add Question
        </button>

        <div className="relative">
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <Zap size={15} />
            Templates
            <ChevronDown size={13} />
          </button>
          {showPresets && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-lg min-w-[220px] py-1">
              {PRESET_TEMPLATES.map((p) => (
                <button
                  key={p.label}
                  onClick={() => addPreset(p)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={15} />
              Save Questions
            </>
          )}
        </button>
      </div>
    </div>
  )
}
