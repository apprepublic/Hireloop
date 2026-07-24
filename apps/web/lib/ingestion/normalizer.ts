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

export const ATS_PLATFORMS = [
  { id: 'greenhouse', domain: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', domain: 'lever', label: 'Lever' },
  { id: 'workable', domain: 'workable', label: 'Workable' },
  { id: 'bamboohr', domain: 'bamboohr', label: 'BambooHR' },
  { id: 'icims', domain: 'icims', label: 'iCIMS' },
  { id: 'smartrecruiters', domain: 'smartrecruiters', label: 'SmartRecruiters' },
  { id: 'jobvite', domain: 'jobvite', label: 'Jobvite' },
  { id: 'ashby', domain: 'ashbyhq', label: 'Ashby' },
  { id: 'pinpoint', domain: 'pinpointhq', label: 'Pinpoint' },
  { id: 'comeet', domain: 'comeet', label: 'Comeet' },
  { id: 'freshteam', domain: 'freshteam', label: 'Freshteam' },
  { id: 'manatal', domain: 'manatal', label: 'Manatal' },
  { id: 'recruitee', domain: 'recruitee', label: 'Recruitee' },
  { id: 'teamtailor', domain: 'teamtailor', label: 'Teamtailor' },
  { id: 'breezy', domain: 'breezy', label: 'Breezy' },
  { id: 'zohorecruit', domain: 'zohorecruit', label: 'Zoho Recruit' },
]

export function detectATSPlatform(applyUrl: string): string | null {
  if (!applyUrl) return null
  const url = applyUrl.toLowerCase()
  for (const ats of ATS_PLATFORMS) {
    if (url.includes(ats.domain)) return ats.id
  }
  return null
}

export function getATSFieldHints(atsPlatform: string): string[] {
  const common = ['name', 'email', 'phone', 'resume', 'cover_letter']
  const hints: Record<string, string[]> = {
    greenhouse: [...common, 'linkedin_profile', 'website', 'work_authorization', 'gender', 'race', 'veteran', 'disability'],
    lever: [...common, 'linkedin_profile', 'website', 'work_authorization', 'how_did_you_hear'],
    workable: [...common, 'linkedin_profile', 'website', 'work_authorization', 'how_did_you_hear', 'salary_expectation'],
    bamboohr: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear'],
    icims: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear', 'salary_expectation'],
    smartrecruiters: [...common, 'linkedin_profile', 'how_did_you_hear'],
    jobvite: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear'],
    ashby: [...common, 'linkedin_profile', 'website', 'work_authorization', 'how_did_you_hear'],
    pinpoint: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear'],
    comeet: [...common, 'linkedin_profile', 'how_did_you_hear'],
    freshteam: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear'],
    manatal: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear'],
    recruitee: [...common, 'linkedin_profile', 'how_did_you_hear'],
    teamtailor: [...common, 'linkedin_profile', 'how_did_you_hear'],
    breezy: [...common, 'linkedin_profile', 'website', 'work_authorization'],
    zohorecruit: [...common, 'linkedin_profile', 'work_authorization', 'how_did_you_hear', 'salary_expectation'],
  }
  return hints[atsPlatform] || common
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
