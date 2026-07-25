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
  if (rawJobs.length === 0) return { inserted: 0, updated: 0 }

  const supabase = getSupabaseAdmin()
  const normalized = await Promise.all(rawJobs.map(j => normalizeJob(j)))

  if (isLinkedIn) {
    for (const job of normalized) {
      job.auto_apply_eligible = false
    }
  }

  const sourceId = normalized[0].source_id
  const externalIds = normalized.map(j => j.external_id)

  const { data: existing } = await supabase
    .from('jobs')
    .select('external_id')
    .eq('source_id', sourceId)
    .in('external_id', externalIds)

  const existingSet = new Set(existing?.map(j => j.external_id) ?? [])
  const existingCount = [...new Set(externalIds)].filter(id => existingSet.has(id)).length

  const { error } = await supabase
    .from('jobs')
    .upsert(normalized, { onConflict: 'source_id, external_id' })

  if (error) throw error

  const inserted = normalized.length - existingCount
  const updated = existingCount

  return { inserted, updated }
}
