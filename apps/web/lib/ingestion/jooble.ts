import type { RawJob, IngestionResult } from './types'

const JOOBLE_API_BASE = 'https://jooble.org/api'

function mapJoobleJob(item: any): RawJob | null {
  if (!item?.title || !item?.company) return null

  let salaryMin: number | null = null
  let salaryMax: number | null = null
  if (item.salary) {
    const parts = item.salary.replace(/[^0-9\-]/g, '').split('-')
    if (parts.length === 2) {
      salaryMin = parseInt(parts[0], 10) || null
      salaryMax = parseInt(parts[1], 10) || null
    } else if (parts.length === 1) {
      salaryMax = parseInt(parts[0], 10) || null
    }
  }

  return {
    source_id: 'jooble',
    external_id: String(item.id),
    title: item.title,
    company: item.company,
    location: item.location || null,
    is_remote: item.remote || false,
    description: item.snippet || item.description || '',
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: 'USD',
    job_type: item.type?.toLowerCase() || null,
    seniority: null,
    apply_url: item.url || '',
    ats_platform: null,
    posted_at: item.updated ? new Date(item.updated).toISOString() : null,
  }
}

export async function fetchJoobleJobs(
  apiKey: string,
  keywords: string,
  location?: string,
): Promise<{ jobs: RawJob[]; result: IngestionResult }> {
  const errors: string[] = []
  const jobs: RawJob[] = []

  try {
    const res = await fetch(`${JOOBLE_API_BASE}/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords,
        location: location || '',
        page: 1,
        resultOnPage: 50,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      errors.push(`Jooble API error ${res.status}: ${text}`)
      return { jobs, result: { source: 'jooble', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const data = await res.json()
    const results = data.jobs || []

    for (const item of results) {
      const job = mapJoobleJob(item)
      if (job) jobs.push(job)
    }
  } catch (err: any) {
    errors.push(`Jooble fetch error: ${err.message}`)
  }

  return {
    jobs,
    result: { source: 'jooble', fetched: jobs.length, inserted: 0, updated: 0, errors },
  }
}
