import type { RawJob, IngestionResult } from './types'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'aligned_safe~linkedin-jobs-scraper-2026'

function pick(item: any, keys: string[]): string {
  for (const k of keys) {
    const v = item[k]
    if (v != null && v !== '') return String(v)
  }
  return ''
}

function mapLinkedInJob(item: any): RawJob | null {
  const title = pick(item, ['title', 'job_title', 'jobTitle', 'position'])
  const company = pick(item, ['company', 'company_name', 'companyName', 'company_name', 'employer', 'organization'])
  if (!title || !company) return null

  let salaryMin: number | null = null
  let salaryMax: number | null = null
  const rawSalary = item.salary || item.salary_text || item.salaryText || ''
  if (rawSalary) {
    const nums = String(rawSalary).replace(/[$£€,]/g, '').match(/([\d.]+)/g)?.map(Number) || []
    if (nums.length >= 2) { salaryMin = nums[0]; salaryMax = nums[1] }
    else if (nums.length === 1) { salaryMax = nums[0] }
  }

  const rawType = pick(item, ['contract_type', 'contractType', 'job_type', 'jobType', 'employment_type', 'employmentType'])
  const rawSeniority = pick(item, ['experience_level', 'experienceLevel', 'seniority_level', 'seniorityLevel'])
  const rawDate = pick(item, ['posted_date', 'postedDate', 'posted_at', 'postedAt', 'date_posted', 'datePosted', 'scrapedAt'])
  const rawLocation = pick(item, ['location', 'locations', 'city', 'job_location', 'jobLocation'])
  const rawDescription = pick(item, ['description', 'description_text', 'descriptionText', 'description_html', 'descriptionHtml', 'snippet'])

  return {
    source_id: 'linkedin_unofficial',
    external_id: String(item.id || item.url || item.linkedinUrl || item.canonicalJobId || item.job_id || item.jobId || item.listingId || title),
    title,
    company,
    location: rawLocation || null,
    is_remote: /remote|work-from-home|wfh/i.test(rawLocation || ''),
    description: rawDescription,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: 'USD',
    job_type: rawType.toLowerCase() || null,
    seniority: rawSeniority.toLowerCase() || null,
    apply_url: pick(item, ['url', 'apply_url', 'applyUrl', 'linkedin_url', 'linkedinUrl', 'job_url', 'jobUrl']),
    ats_platform: null,
    posted_at: rawDate ? new Date(rawDate).toISOString() : null,
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
      location: location || 'United States',
      pages: 1,
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
    const raw = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
    if (!Array.isArray(raw)) {
      errors.push(`LinkedIn: Response shape: ${JSON.stringify(body).slice(0, 500)}`)
    } else if (raw.length === 0) {
      errors.push(`LinkedIn: 0 results for keyword="${runInput.keyword}" location="${runInput.location}"`)
    } else {
      for (const item of raw) {
        const job = mapLinkedInJob(item)
        if (job) jobs.push(job)
        else errors.push(`LinkedIn: Skipped item (missing title/company): keys=${Object.keys(item).join(',')}`)
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
