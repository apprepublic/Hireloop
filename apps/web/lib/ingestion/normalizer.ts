import type { RawJob } from './types'
import crypto from 'crypto'

export function computeDedupeHash(job: { title: string; company: string; location: string | null }): string {
  const raw = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}|${(job.location || '').toLowerCase().trim()}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

export function computeMatchScore(job: RawJob): number {
  let score = 0
  if (job.salary_min || job.salary_max) score += 20
  if (job.description && job.description.length > 100) score += 25
  if (job.location) score += 10
  if (job.company) score += 10
  if (job.job_type) score += 10
  if (job.seniority) score += 10
  if (job.is_remote !== undefined) score += 5
  if (job.posted_at) score += 10

  return Math.min(score, 100)
}

export function detectATSPlatform(applyUrl: string): string | null {
  if (!applyUrl) return null
  const url = applyUrl.toLowerCase()
  if (url.includes('greenhouse')) return 'greenhouse'
  if (url.includes('lever')) return 'lever'
  if (url.includes('workable')) return 'workable'
  if (url.includes('bamboohr')) return 'bamboohr'
  if (url.includes('icims')) return 'icims'
  if (url.includes('smartrecruiters')) return 'smartrecruiters'
  if (url.includes('jobvite')) return 'jobvite'
  return null
}

export function normalizeJob(raw: RawJob) {
  return {
    source_id: raw.source_id,
    external_id: raw.external_id,
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location?.trim() || null,
    is_remote: raw.is_remote,
    description: raw.description.trim(),
    salary_min: raw.salary_min,
    salary_max: raw.salary_max,
    currency: raw.currency || 'USD',
    job_type: raw.job_type,
    seniority: raw.seniority,
    apply_url: raw.apply_url.trim(),
    ats_platform: detectATSPlatform(raw.apply_url),
    auto_apply_eligible: raw.source_id !== 'linkedin_unofficial' && detectATSPlatform(raw.apply_url) !== null,
    posted_at: raw.posted_at ? new Date(raw.posted_at).toISOString() : null,
    dedupe_hash: computeDedupeHash(raw),
    match_score: computeMatchScore(raw),
  }
}
