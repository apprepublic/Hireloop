import type { RawJob, IngestionResult } from './types'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'valig/linkedin-jobs-scraper'

function mapLinkedInJob(item: any): RawJob | null {
  if (!item?.title || !item?.companyName) return null

  return {
    source_id: 'linkedin_unofficial',
    external_id: String(item.id || item.jobId || item.url),
    title: item.title,
    company: item.companyName,
    location: item.location || null,
    is_remote: item.workType === 'remote' || item.isRemote || false,
    description: item.description || item.jobDescription || '',
    salary_min: item.salaryMin || null,
    salary_max: item.salaryMax || null,
    currency: item.salaryCurrency || 'USD',
    job_type: item.jobType?.toLowerCase() || null,
    seniority: item.seniorityLevel?.toLowerCase() || null,
    apply_url: item.url || item.jobUrl || '',
    ats_platform: null,
    posted_at: item.postedAt ? new Date(item.postedAt).toISOString() : null,
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
    const runInput = {
      position: searchTerms.join(' '),
      location: location || '',
      maxResults: 50,
      proxy: { useApifyProxy: true },
    }

    const runRes = await fetch(
      `${APIFY_API_BASE}/acts/${ACTOR_ID}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runInput),
      },
    )

    if (!runRes.ok) {
      const text = await runRes.text()
      errors.push(`Apify run error ${runRes.status}: ${text}`)
      return { jobs, result: { source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const runData = await runRes.json()
    const datasetId = runData.data?.defaultDatasetId

    if (!datasetId) {
      errors.push('Apify: no dataset ID returned')
      return { jobs, result: { source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const maxWait = 30
    for (let i = 0; i < maxWait; i++) {
      const statusRes = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runData.data.id}?token=${apifyToken}`,
      )
      const statusData = await statusRes.json()
      if (statusData.data?.status === 'SUCCEEDED') break
      if (statusData.data?.status === 'FAILED') {
        errors.push('Apify actor run failed')
        return { jobs, result: { source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors } }
      }
      await new Promise((r) => setTimeout(r, 3000))
    }

    const datasetRes = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apifyToken}`,
    )
    if (!datasetRes.ok) {
      errors.push(`Apify dataset fetch error ${datasetRes.status}`)
      return { jobs, result: { source: 'linkedin_unofficial', fetched: 0, inserted: 0, updated: 0, errors } }
    }

    const items = await datasetRes.json()
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
