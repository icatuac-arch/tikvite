'use client'
import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: number
  interactive?: boolean
  onChange?: (rating: number) => void
}

export default function StarRating({ rating, maxStars = 5, size = 16, interactive = false, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={`${i < Math.round(rating) ? 'fill-[#4F46E5] text-[#4F46E5]' : 'fill-none text-gray-600'} ${interactive ? 'cursor-pointer hover:text-[#4F46E5]' : ''}`}
          onClick={() => interactive && onChange?.(i + 1)}
        />
      ))}
    </div>
  )
}
