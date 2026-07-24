import type { RawJob, IngestionResult } from './types'

const ADZUNA_API_BASE = 'https://api.adzuna.com/v1/api/jobs'

function mapAdzunaJob(item: any, country: string, appId: string, appKey: string): RawJob | null {
  if (!item?.title || !item?.company?.display_name) return null

  const salaryMin = item.salary_min ? Math.round(item.salary_min) : null
  const salaryMax = item.salary_max ? Math.round(item.salary_max) : null

  return {
    source_id: 'adzuna',
    external_id: String(item.id),
    title: item.title,
    company: item.company.display_name,
    location: item.location?.display_name || null,
    is_remote: item.remote || false,
    description: item.description || '',
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: item.salary_currency || 'USD',
    job_type: item.contract_type?.toLowerCase() || null,
    seniority: null,
    apply_url: item.redirect_url,
    ats_platform: null,
    posted_at: item.created ? new Date(item.created).toISOString() : null,
  }
}

export async function fetchAdzunaJobs(
  appId: string,
  appKey: string,
  country: string = 'gb',
  what?: string,
  where?: string,
): Promise<{ jobs: RawJob[]; result: IngestionResult }> {
  const errors: string[] = []
  const jobs: RawJob[] = []

  try {
    const params = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: '50' })
    if (what) params.set('what', what)
    if (where) params.set('where', where)

    const url = `${ADZUNA_API_BASE}/${country}/search/1?${params.toString()}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })

    if (!res.ok) {
      const text = await res.text()
      errors.push(`Adzuna API error ${res.status}: ${text}`)
      return { jobs, result: { source: 'adzuna', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const data = await res.json()
    const results = data.results || []

    for (const item of results) {
      const job = mapAdzunaJob(item, country, appId, appKey)
      if (job) jobs.push(job)
    }
  } catch (err: any) {
    errors.push(`Adzuna fetch error: ${err.message}`)
  }

  return {
    jobs,
    result: { source: 'adzuna', fetched: jobs.length, inserted: 0, updated: 0, errors },
  }
}
