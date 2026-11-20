'use client'

import type { ChecklistItem } from '@/lib/event-checklist'
import { CheckCircle2, Circle, Info } from 'lucide-react'

interface EventChecklistProps {
  items: ChecklistItem[]
  complete: number
  total: number
  requiredComplete: number
  requiredTotal: number
  ready: boolean
  status: 'draft' | 'ready' | 'live'
  compact?: boolean
  onItemClick?: (section: string) => void
}

const STATUS_CONFIG = {
  draft: { label: 'DRAFT', bg: 'bg-gray-200', text: 'text-gray-600', dot: '' },
  ready: { label: 'READY', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'animate-pulse' },
  live: { label: 'LIVE', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
}

export function StatusBadge({ status }: { status: 'draft' | 'ready' | 'live' }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {status === 'live' && (
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      )}
      {status === 'ready' && (
        <span className={`w-2 h-2 rounded-full bg-amber-500 ${cfg.dot}`} />
      )}
      {cfg.label}
    </span>
  )
}

export default function EventChecklist({
  items,
  complete,
  total,
  requiredComplete,
  requiredTotal,
  ready,
  status,
  compact = false,
  onItemClick,
}: EventChecklistProps) {
  const pct = requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : 0

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: '#475569' }}>
            {requiredComplete}/{requiredTotal} required
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: ready ? '#2D7A3A' : '#4F46E5' }}
          />
        </div>
        {!ready && (
          <div className="text-[10px] font-medium" style={{ color: '#7C3AED' }}>
            {requiredTotal - requiredComplete} item{requiredTotal - requiredComplete !== 1 ? 's' : ''} needed to go live
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
            Setup Checklist
          </h3>
          <StatusBadge status={status} />
        </div>
        <div className="text-right">
          <span className="text-sm font-bold" style={{ color: ready ? '#2D7A3A' : '#4F46E5' }}>
            {requiredComplete}/{requiredTotal} required
          </span>
          {!ready && (
            <div className="text-[10px]" style={{ color: '#7C3AED' }}>
              {requiredTotal - requiredComplete} more to go live
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#4F46E5' }}
        />
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors"
            style={{
              borderColor: item.complete ? '#D1FAE5' : item.required ? '#FEF3C7' : '#E2E8F0',
              backgroundColor: item.complete ? '#F1F8E9' : '#fff',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.complete ? (
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              ) : item.required ? (
                <Circle size={18} className="text-amber-500 flex-shrink-0" />
              ) : (
                <Circle size={18} className="text-gray-400 flex-shrink-0" />
              )}
              <span
                className="text-sm truncate"
                style={{ color: item.complete ? '#2E7D32' : '#334155' }}
              >
                {item.label}
              </span>
            </div>

            {!item.complete && (
              item.required ? (
                <button
                  onClick={() => onItemClick?.(item.section)}
                  className="flex-shrink-0 text-xs font-semibold hover:underline whitespace-nowrap"
                  style={{ color: '#7C3AED' }}
                >
                  {item.fixLabel || 'Fix'} &rarr;
                </button>
              ) : (
                <span className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400">
                  <Info size={12} />
                  Recommended
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
