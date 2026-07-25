import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeJob } from './normalizer'
import { fetchAdzunaJobs } from './adzuna'
import { fetchJoobleJobs } from './jooble'
import { fetchLinkedInJobs } from './linkedin'
import type { IngestionResult } from './types'

export type { IngestionResult } from './types'

export async function ingestAll(): Promise<IngestionResult[]> {
  const adzunaId = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_API_KEY
  const adzunaCountry = process.env.ADZUNA_COUNTRY || 'gb'
  const joobleKey = process.env.JOOBLE_API_KEY
  const apifyToken = process.env.APIFY_API_TOKEN
  const linkedInEnabled = process.env.LINKEDIN_INGESTION_ENABLED === 'true'
  const searchKeywords = process.env.INGESTION_KEYWORDS || 'software engineer'

  const tasks: Promise<IngestionResult>[] = []

  if (adzunaId && adzunaKey) {
    tasks.push(
      fetchAdzunaJobs(adzunaId, adzunaKey, adzunaCountry, searchKeywords)
        .then(async ({ jobs, result }) => {
          const { inserted, updated } = await upsertJobs(jobs)
          return { ...result, inserted, updated }
        }),
    )
  } else {
    tasks.push(Promise.resolve({ source: 'adzuna', fetched: 0, inserted: 0, updated: 0, errors: ['Adzuna not configured'] }))
  }

  if (joobleKey) {
    tasks.push(
      fetchJoobleJobs(joobleKey, searchKeywords)
        .then(async ({ jobs, result }) => {
          const { inserted, updated } = await upsertJobs(jobs)
          return { ...result, inserted, updated }
        }),
    )
  } else {
    tasks.push(Promise.resolve({ source: 'jooble', fetched: 0, inserted: 0, updated: 0, errors: ['Jooble not configured'] }))
  }

  if (apifyToken && linkedInEnabled) {
    tasks.push(
      fetchLinkedInJobs(apifyToken, ['software engineer'])
        .then(async ({ jobs, result }) => {
          const { inserted, updated } = await upsertJobs(jobs, true)
          return { ...result, inserted, updated }
        }),
    )
  } else {
    tasks.push(Promise.resolve({ source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors: ['LinkedIn not configured or disabled'] }))
  }

  return Promise.all(tasks)
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
