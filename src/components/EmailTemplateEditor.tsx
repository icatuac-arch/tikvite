'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, Eye, RotateCcw, Mail } from 'lucide-react'
import {
  DEFAULTS,
  TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  resolveTemplate,
  getSampleVars,
} from '@/lib/email-templates'

interface Props {
  templates: Record<string, string>
  onChange: (templates: Record<string, string>) => void
}

export default function EmailTemplateEditor({ templates, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
    setPreviewType(null)
  }

  const updateTemplate = useCallback(
    (key: string, value: string) => {
      onChange({ ...templates, [key]: value })
    },
    [templates, onChange],
  )

  const resetTemplate = useCallback(
    (subjectKey: string, bodyKey: string) => {
      const next = { ...templates }
      delete next[subjectKey]
      delete next[bodyKey]
      onChange(next)
    },
    [templates, onChange],
  )

  return (
    <div className="space-y-3">
      {TEMPLATE_TYPES.map((type) => {
        const isOpen = expanded === type.id
        const hasCustom = !!(templates[type.subjectKey]?.trim() || templates[type.bodyKey]?.trim())

        return (
          <div
            key={type.id}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}
          >
            {/* Accordion header */}
            <button
              onClick={() => toggle(type.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail size={16} style={{ color: '#7C3AED' }} />
                <span className="text-sm font-semibold" style={{ color: '#334155' }}>
                  {type.label}
                </span>
                {hasCustom && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#D1FAE5', color: '#2E7D32' }}
                  >
                    Customized
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronDown size={16} style={{ color: '#94A3B8' }} />
              ) : (
                <ChevronRight size={16} style={{ color: '#94A3B8' }} />
              )}
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                {/* Subject */}
                <div className="pt-4">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: '#475569' }}
                  >
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={templates[type.subjectKey] ?? ''}
                    onChange={(e) => updateTemplate(type.subjectKey, e.target.value)}
                    placeholder={DEFAULTS[type.subjectKey]}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 transition-all"
                    style={{ borderColor: '#E2E8F0', color: '#334155', backgroundColor: '#fff' }}
                  />
                </div>

                {/* Body */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: '#475569' }}
                  >
                    Email Body
                  </label>
                  <TemplateTextarea
                    value={templates[type.bodyKey] ?? ''}
                    placeholder={DEFAULTS[type.bodyKey]}
                    onChange={(val) => updateTemplate(type.bodyKey, val)}
                  />
                </div>

                {/* Variable chips */}
                <div>
                  <p className="text-[11px] font-medium mb-2" style={{ color: '#94A3B8' }}>
                    Click to insert variable:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <VariableChip key={v.key} variable={v.key} bodyKey={type.bodyKey} />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      setPreviewType((prev) => (prev === type.id ? null : type.id))
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
                    style={{ borderColor: '#E2E8F0', color: '#475569' }}
                  >
                    <Eye size={12} /> {previewType === type.id ? 'Hide Preview' : 'Preview'}
                  </button>
                  {hasCustom && (
                    <button
                      onClick={() => resetTemplate(type.subjectKey, type.bodyKey)}
                      className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70"
                      style={{ color: '#C62828' }}
                    >
                      <RotateCcw size={12} /> Reset to default
                    </button>
                  )}
                </div>

                {/* Preview */}
                {previewType === type.id && (
                  <TemplatePreview
                    subjectKey={type.subjectKey}
                    bodyKey={type.bodyKey}
                    templates={templates}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Textarea with cursor-aware variable insertion support. */
function TemplateTextarea({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (val: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  return (
    <textarea
      ref={ref}
      rows={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 transition-all resize-y font-mono"
      style={{
        borderColor: '#E2E8F0',
        color: '#334155',
        backgroundColor: '#fff',
        lineHeight: 1.6,
      }}
      data-template-textarea
    />
  )
}

/** Clickable variable chip — inserts at cursor in the nearest textarea above. */
function VariableChip({ variable, bodyKey }: { variable: string; bodyKey: string }) {
  const handleClick = () => {
    // Find the textarea in the same accordion section
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(
      'textarea[data-template-textarea]',
    )
    // Find the last visible one (the one in the open accordion)
    let target: HTMLTextAreaElement | null = null
    textareas.forEach((ta) => {
      if (ta.offsetParent !== null) target = ta
    })
    if (!target) return

    const ta = target as HTMLTextAreaElement
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? ta.value.length
    const insert = `{{${variable}}}`
    const newVal = ta.value.substring(0, start) + insert + ta.value.substring(end)

    // Trigger a React-compatible change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    nativeInputValueSetter?.call(ta, newVal)
    ta.dispatchEvent(new Event('input', { bubbles: true }))

    // Restore focus & cursor position
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + insert.length, start + insert.length)
    }, 0)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-colors hover:bg-[#F8FAFC]"
      style={{ borderColor: '#E2E8F0', color: '#7C3AED', backgroundColor: '#FEFAF3' }}
    >
      {'{{'}
      {variable}
      {'}}'}
    </button>
  )
}

/** Preview card showing rendered template with sample data. */
function TemplatePreview({
  subjectKey,
  bodyKey,
  templates,
}: {
  subjectKey: string
  bodyKey: string
  templates: Record<string, string>
}) {
  const sampleVars = getSampleVars()
  const subject = resolveTemplate(templates, subjectKey, sampleVars)
  const body = resolveTemplate(templates, bodyKey, sampleVars)

  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#94A3B8' }}>
        Preview with sample data
      </p>
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: '#4F46E5' }}>
          Subject: {subject}
        </p>
        <div
          className="text-sm whitespace-pre-wrap"
          style={{ color: '#334155', lineHeight: 1.6 }}
        >
          {body}
        </div>
      </div>
    </div>
  )
}
