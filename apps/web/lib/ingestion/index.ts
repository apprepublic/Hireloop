import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeJob } from './normalizer'
import { fetchAdzunaJobs } from './adzuna'
import { fetchJoobleJobs } from './jooble'
import { fetchLinkedInJobs } from './linkedin'
import type { IngestionResult } from './types'

export type { IngestionResult } from './types'

export async function ingestAll(): Promise<IngestionResult[]> {
  const results: IngestionResult[] = []

  const adzunaId = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_API_KEY
  const adzunaCountry = process.env.ADZUNA_COUNTRY || 'gb'
  const joobleKey = process.env.JOOBLE_API_KEY
  const apifyToken = process.env.APIFY_API_TOKEN
  const linkedInEnabled = process.env.LINKEDIN_INGESTION_ENABLED === 'true'
  const searchKeywords = process.env.INGESTION_KEYWORDS || 'software engineer'

  if (adzunaId && adzunaKey) {
    const { jobs, result } = await fetchAdzunaJobs(adzunaId, adzunaKey, adzunaCountry, searchKeywords)
    const { inserted, updated } = await upsertJobs(jobs)
    results.push({ ...result, inserted, updated })
  } else {
    results.push({ source: 'adzuna', fetched: 0, inserted: 0, updated: 0, errors: ['Adzuna not configured'] })
  }

  if (joobleKey) {
    const { jobs, result } = await fetchJoobleJobs(joobleKey, searchKeywords)
    const { inserted, updated } = await upsertJobs(jobs)
    results.push({ ...result, inserted, updated })
  } else {
    results.push({ source: 'jooble', fetched: 0, inserted: 0, updated: 0, errors: ['Jooble not configured'] })
  }

  if (apifyToken && linkedInEnabled) {
    const { jobs, result } = await fetchLinkedInJobs(apifyToken, ['software engineer'])
    const { inserted, updated } = await upsertJobs(jobs, true)
    results.push({ ...result, inserted, updated })
  } else {
    results.push({ source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors: ['LinkedIn not configured or disabled'] })
  }

  return results
}

async function upsertJobs(
  rawJobs: import('./types').RawJob[],
  isLinkedIn: boolean = false,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0

  for (const raw of rawJobs) {
    const normalized = await normalizeJob(raw)

    const { data: existing } = await getSupabaseAdmin()
      .from('jobs')
      .select('id')
      .eq('source_id', normalized.source_id)
      .eq('external_id', normalized.external_id)
      .maybeSingle()

    if (existing) {
      const { error } = await getSupabaseAdmin()
        .from('jobs')
        .update({
          title: normalized.title,
          company: normalized.company,
          location: normalized.location,
          is_remote: normalized.is_remote,
          description: normalized.description,
          salary_min: normalized.salary_min,
          salary_max: normalized.salary_max,
          job_type: normalized.job_type,
          seniority: normalized.seniority,
          apply_url: normalized.apply_url,
          ats_platform: normalized.ats_platform,
          auto_apply_eligible: isLinkedIn ? false : normalized.auto_apply_eligible,
          posted_at: normalized.posted_at,
          match_score: normalized.match_score,
        })
        .eq('id', existing.id)

      if (!error) updated++
    } else {
      const { error } = await getSupabaseAdmin()
        .from('jobs')
        .insert({
          ...normalized,
          auto_apply_eligible: isLinkedIn ? false : normalized.auto_apply_eligible,
        })

      if (!error) inserted++
    }
  }

  return { inserted, updated }
}
