export interface RawJob {
  source_id: string
  external_id: string
  title: string
  company: string
  location: string | null
  is_remote: boolean
  description: string
  salary_min: number | null
  salary_max: number | null
  currency: string
  job_type: string | null
  seniority: string | null
  apply_url: string
  ats_platform: string | null
  posted_at: string | null
}

export interface IngestionResult {
  source: string
  fetched: number
  inserted: number
  updated: number
  errors: string[]
}
