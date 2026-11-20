'use client'

import type { LayoutSection } from '@/lib/seating-types'

interface Props {
  section: LayoutSection
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onDragStart?: (e: React.MouseEvent) => void
  onDragEnd?: () => void
  editable?: boolean
}

export default function SectionRect({
  section,
  selected,
  onClick,
  onDragStart,
  editable = false,
}: Props) {
  const sectionColor = section.color || '#E2E8F0'

  return (
    <g
      onClick={onClick}
      onMouseDown={editable ? onDragStart : undefined}
      style={{ cursor: editable ? 'move' : 'default' }}
    >
      {/* Selection highlight */}
      {selected && (
        <rect
          x={section.x - 3}
          y={section.y - 3}
          width={section.width + 6}
          height={section.height + 6}
          rx={6}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}
      {/* Section background */}
      <rect
        x={section.x}
        y={section.y}
        width={section.width}
        height={section.height}
        rx={4}
        fill={sectionColor}
        fillOpacity={0.2}
        stroke={sectionColor}
        strokeWidth={1.5}
        strokeDasharray="8 4"
      />
      {/* Section label */}
      <text
        x={section.x + section.width / 2}
        y={section.y + 16}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#4F46E5"
        fontSize={12}
        fontWeight={600}
        fontFamily="'Plus Jakarta Sans', serif"
        style={{ pointerEvents: 'none' }}
      >
        {section.name}
      </text>
      {/* VIP badge */}
      {section.section_type === 'vip' && (
        <g>
          <rect
            x={section.x + section.width - 32}
            y={section.y + 4}
            width={28}
            height={14}
            rx={3}
            fill="#7C3AED"
          />
          <text
            x={section.x + section.width - 18}
            y={section.y + 11}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={8}
            fontWeight={700}
          >
            VIP
          </text>
        </g>
      )}
    </g>
  )
}
