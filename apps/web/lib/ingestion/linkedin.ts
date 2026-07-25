import type { RawJob, IngestionResult } from './types'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'crawlerforge~linkedin-jobs-scraper'

function mapLinkedInJob(item: any): RawJob | null {
  if (!item?.title || !item?.company) return null

  let salaryMin: number | null = null
  let salaryMax: number | null = null
  let currency = 'USD'

  return {
    source_id: 'linkedin_unofficial',
    external_id: String(item.id || item.url),
    title: item.title,
    company: item.company,
    location: item.location || null,
    is_remote: false,
    description: item.description || '',
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency,
    job_type: null,
    seniority: null,
    apply_url: item.url || '',
    ats_platform: null,
    posted_at: item.postedDate ? new Date(item.postedDate).toISOString() : null,
  }
}

export async function fetchLinkedInJobs(
  apifyToken: string,
  searchTerms: string[],
  location?: string,
): Promise<{ jobs: RawJob[]; result: IngestionResult }> {
  const errors: string[] = []
  const jobs: RawJob[] = []

  try {
    const runInput: Record<string, unknown> = {
      keyword: searchTerms.join(' '),
      maxJobs: 50,
      fetchDetails: true,
    }
    if (location) runInput.location = location

    const res = await fetch(
      `${APIFY_API_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runInput),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      errors.push(`LinkedIn: Apify error ${res.status}: ${text}`)
      return { jobs, result: { source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const items = await res.json()
    for (const item of items) {
      const job = mapLinkedInJob(item)
      if (job) jobs.push(job)
    }
  } catch (err: any) {
    errors.push(`LinkedIn fetch error: ${err.message}`)
  }

  return {
    jobs,
    result: { source: 'linkedin_unofficial', fetched: jobs.length, inserted: 0, updated: 0, errors },
  }
}
