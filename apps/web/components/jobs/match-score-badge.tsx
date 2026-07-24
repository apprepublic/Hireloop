'use client'

interface MatchScoreBadgeProps {
  score: number
  label?: string
  size?: 'sm' | 'md'
}

export function MatchScoreBadge({ score, label, size = 'sm' }: MatchScoreBadgeProps) {
  const color =
    score >= 80 ? 'bg-green-100 text-green-700' :
    score >= 60 ? 'bg-blue-100 text-blue-700' :
    score >= 40 ? 'bg-amber-100 text-amber-700' :
    'bg-gray-100 text-gray-600'

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full ${color} ${textSize}`}>
      {label && <span>{label}</span>}
      <span>{score}%{size === 'md' ? ' match' : ''}</span>
    </span>
  )
}
