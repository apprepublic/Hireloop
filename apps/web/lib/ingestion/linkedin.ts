import type { RawJob, IngestionResult } from './types'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'bebity~linkedin-jobs-scraper'

function mapLinkedInJob(item: any): RawJob | null {
  if (!item?.title || !item?.companyName) return null

  let salaryMin: number | null = null
  let salaryMax: number | null = null
  if (item.salary) {
    const nums = String(item.salary).replace(/[$£€,]/g, '').match(/([\d.]+)/g)?.map(Number) || []
    if (nums.length >= 2) { salaryMin = nums[0]; salaryMax = nums[1] }
    else if (nums.length === 1) { salaryMax = nums[0] }
  }

  const currency = item.salaryCurrency || 'USD'

  return {
    source_id: 'linkedin_unofficial',
    external_id: String(item.id || item.url || item.title),
    title: item.title,
    company: item.companyName,
    location: item.location || null,
    is_remote: item.workType === '2' || false,
    description: item.description || '',
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency,
    job_type: item.contractType?.toLowerCase() || null,
    seniority: item.experienceLevel?.toLowerCase() || null,
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
      title: searchTerms.join(' '),
      location: location || 'United States',
      rows: 50,
      proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
    }

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

    const body = await res.json()
    const items = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
    if (!Array.isArray(items)) {
      errors.push(`LinkedIn: Unexpected response shape: ${JSON.stringify(body).slice(0, 500)}`)
    } else if (items.length === 0) {
      errors.push(`LinkedIn: Actor returned 0 results for title="${runInput.title}" location="${runInput.location}"`)
    } else {
      for (const item of items) {
        const job = mapLinkedInJob(item)
        if (job) jobs.push(job)
      }
    }
  } catch (err: any) {
    errors.push(`LinkedIn fetch error: ${err.message}`)
  }

  return {
    jobs,
    result: { source: 'linkedin_unofficial', fetched: jobs.length, inserted: 0, updated: 0, errors },
  }
}
