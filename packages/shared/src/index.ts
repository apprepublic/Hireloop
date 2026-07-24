// ============================================================
// HireLoop — Shared Types & Interfaces
// ============================================================

// -----------------------------------------------------------
// Enums / literals
// -----------------------------------------------------------
export type Role = 'USER' | 'ADMIN'

export type RemotePreference = 'remote_only' | 'hybrid_ok' | 'onsite_ok' | 'any'

export type ApplicationMethod = 'manual' | 'auto'

export type ApplicationStatus = 'submitted' | 'failed' | 'ambiguous' | 'user_abandoned'

export type SavedJobState = 'saved' | 'dismissed'

export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary'

export type SourceId = 'adzuna' | 'jooble' | 'linkedin_unofficial'

// -----------------------------------------------------------
// Entities
// -----------------------------------------------------------
export interface JobSource {
  id: SourceId
  display_name: string
  is_compliant: boolean
  is_enabled: boolean
  created_at: string
}

export interface Profile {
  id: string
  email: string
  name: string | null
  role: Role
  created_at: string
  updated_at: string
}

export interface SearchProfile {
  id: string
  user_id: string
  title_keywords: string[]
  location: string | null
  remote_preference: RemotePreference
  seniority: string | null
  salary_min: number | null
  job_type: string | null
  enabled_sources: SourceId[]
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  source_id: SourceId
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
  auto_apply_eligible: boolean
  posted_at: string | null
  ingested_at: string
  dedupe_hash: string
  match_score: number
  created_at: string
}

export interface BaseResume {
  id: string
  user_id: string
  file_url: string
  file_type: string
  parsed_sections: ResumeSections | null
  created_at: string
}

export interface ResumeSections {
  contact: Record<string, string>
  summary: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  skills: string[]
}

export interface ResumeExperience {
  company: string
  title: string
  start_date: string
  end_date: string | null
  description: string
}

export interface ResumeEducation {
  institution: string
  degree: string
  field: string
  start_date: string
  end_date: string | null
}

export interface OptimizedCV {
  id: string
  base_resume_id: string
  job_id: string
  version: number
  generated_sections: ResumeSections
  flagged_terms: string[] | null
  user_approved: boolean
  export_file_url: string | null
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  job_id: string
  optimized_cv_id: string | null
  method: ApplicationMethod
  status: ApplicationStatus
  submitted_at: string | null
  created_at: string
  // joined
  job?: Job
  optimized_cv?: OptimizedCV
}

export interface ApplicationAuditLog {
  id: string
  application_id: string
  step: string
  snapshot_url: string | null
  field_values: Record<string, any> | null
  created_at: string
}

export interface SavedJob {
  id: string
  user_id: string
  job_id: string
  state: SavedJobState
  created_at: string
  // joined
  job?: Job
}

// -----------------------------------------------------------
// API types
// -----------------------------------------------------------
export interface PaginatedResponse<T> {
  data: T[]
  cursor: string | null
  has_more: boolean
}

export interface JobFeedQuery {
  keywords?: string
  location?: string
  remote?: RemotePreference
  seniority?: string
  salary_min?: number
  job_type?: string
  sources?: SourceId[]
  sort?: 'newest' | 'match_score' | 'salary'
  cursor?: string
  limit?: number
}

export interface GenerateCVRequest {
  base_resume_id: string
  job_id: string
}

export interface AutoApplyRequest {
  job_id: string
  optimized_cv_id: string
}

export interface AutoApplyStatus {
  application_id: string
  step: string
  status: ApplicationStatus
  logs: ApplicationAuditLog[]
}
