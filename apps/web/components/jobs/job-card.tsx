'use client'

import type { Job, SourceId } from '@hireloop/shared'
import { MatchScoreBadge } from './match-score-badge'

const sourceConfig: Record<SourceId, { label: string; className: string }> = {
  adzuna: { label: 'Adzuna', className: 'bg-blue-100 text-blue-700' },
  jooble: { label: 'Jooble', className: 'bg-green-100 text-green-700' },
  linkedin_unofficial: { label: 'LinkedIn', className: 'bg-amber-100 text-amber-700' },
}

interface JobCardProps {
  job: Job
  savedState?: 'saved' | 'dismissed' | null
  onSave?: () => void
  onDismiss?: () => void
  onSelect?: () => void
}

export function JobCard({ job, savedState, onSave, onDismiss, onSelect }: JobCardProps) {
  const source = sourceConfig[job.source_id] || { label: job.source_id, className: 'bg-gray-100 text-gray-700' }

  const timeAgo = job.posted_at
    ? (() => {
        const diff = Date.now() - new Date(job.posted_at).getTime()
        const days = Math.floor(diff / 86400000)
        if (days === 0) return 'Today'
        if (days === 1) return 'Yesterday'
        return `${days}d ago`
      })()
    : null

  return (
    <div
      onClick={onSelect}
      className="group bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${source.className}`}>
              {source.label}
            </span>
            {job.match_score > 0 && (
              <MatchScoreBadge score={job.match_score} />
            )}
          </div>
          <h3 className="font-semibold text-base truncate">{job.title}</h3>
          <p className="text-sm text-muted-foreground truncate">{job.company}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onSave() }}
              className={`p-1.5 rounded-md hover:bg-accent transition-colors ${
                savedState === 'saved' ? 'text-primary' : 'text-muted-foreground'
              }`}
              title={savedState === 'saved' ? 'Saved' : 'Save job'}
            >
              <svg className="w-4 h-4" fill={savedState === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss() }}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        {job.location && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {job.location}
          </span>
        )}
        {job.is_remote && (
          <span className="text-green-600 font-medium">Remote</span>
        )}
        {(job.salary_min || job.salary_max) && (
          <span className="flex items-center gap-1">
            {job.salary_min && job.salary_max
              ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
              : job.salary_min
                ? `From $${job.salary_min.toLocaleString()}`
                : `Up to $${job.salary_max!.toLocaleString()}`}
          </span>
        )}
        {timeAgo && <span className="ml-auto">{timeAgo}</span>}
      </div>
    </div>
  )
}
