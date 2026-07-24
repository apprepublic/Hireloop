import type { RawJob, IngestionResult } from './types'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'valig/linkedin-jobs-scraper'

const MONTHLY_RUN_LIMIT = 5

function parseSalary(salary: string | null): { salary_min: number | null; salary_max: number | null; currency: string } {
  if (!salary) return { salary_min: null, salary_max: null, currency: 'USD' }

  const currencyMatch = salary.match(/[$£€]/)
  const currencyMap: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR' }
  const currency = currencyMap[currencyMatch?.[0] || ''] || 'USD'

  const cleaned = salary.replace(/[$£€,]/g, '')
  const numbers = cleaned.match(/([\d.]+)/g)?.map(Number) || []
  const [min, max] = numbers.length >= 2 ? [numbers[0], numbers[1]] : numbers.length === 1 ? [numbers[0], null] : [null, null]

  return { salary_min: min, salary_max: max, currency }
}

function mapLinkedInJob(item: any): RawJob | null {
  if (!item?.title || !item?.companyName) return null

  const { salary_min, salary_max, currency } = parseSalary(item.salary || null)

  const remoteMap: Record<string, boolean> = {
    'remote': true,
    'hybrid': false,
    'on-site': false,
  }
  const isRemote = item.remote === '2' || remoteMap[item.workType?.toLowerCase()] === true || false

  return {
    source_id: 'linkedin_unofficial',
    external_id: String(item.id || item.url),
    title: item.title,
    company: item.companyName,
    location: item.location || null,
    is_remote: isRemote,
    description: item.description || item.descriptionHtml || '',
    salary_min,
    salary_max,
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
      limit: 50,
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
      if (res.status === 429) {
        errors.push(`LinkedIn: Monthly ingestion limit reached (${MONTHLY_RUN_LIMIT})`)
      } else {
        errors.push(`LinkedIn: Apify error ${res.status}: ${text}`)
      }
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
