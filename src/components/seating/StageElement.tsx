'use client'

import type { StagePosition } from '@/lib/seating-types'

interface Props {
  position: StagePosition
  layoutWidth: number
  layoutHeight: number
}

export default function StageElement({ position, layoutWidth, layoutHeight }: Props) {
  const stageW = Math.min(layoutWidth * 0.6, 400)
  const stageH = 40
  const x = (layoutWidth - stageW) / 2

  let y: number
  if (position === 'bottom') {
    y = layoutHeight - stageH - 20
  } else {
    y = 20
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={stageW}
        height={stageH}
        rx={6}
        fill="#E2E8F0"
        stroke="#7C3AED"
        strokeWidth={2}
      />
      <text
        x={x + stageW / 2}
        y={y + stageH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#4F46E5"
        fontSize={14}
        fontWeight={700}
        fontFamily="'Plus Jakarta Sans', serif"
        style={{ letterSpacing: 3 }}
      >
        STAGE
      </text>
    </g>
  )
}
