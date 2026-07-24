import { supabase } from './supabase'
import type { Application, ApplicationAuditLog, BaseResume, Job, SavedJob, SearchProfile, SourceId } from '@hireloop/shared'

export async function getJobs(opts: {
  keywords?: string[]
  location?: string
  remote?: string
  seniority?: string
  salary_min?: number
  job_type?: string
  sources?: SourceId[]
  sort?: string
  cursor?: string
  limit?: number
} = {}): Promise<{ data: Job[]; cursor: string | null; has_more: boolean }> {
  let q = supabase
    .from('jobs')
    .select('*')
    .order(opts.sort === 'salary' ? 'salary_max' : opts.sort === 'match_score' ? 'match_score' : 'posted_at', {
      ascending: false,
      nullsFirst: false,
    })
    .limit(opts.limit ?? 20)

  if (opts.cursor) {
    const cursorField = opts.sort === 'salary' ? 'salary_max' : opts.sort === 'match_score' ? 'match_score' : 'posted_at'
    q = q.lt(cursorField, opts.cursor)
  }

  if (opts.sources && opts.sources.length > 0) {
    q = q.in('source_id', opts.sources)
  }

  if (opts.location) {
    q = q.ilike('location', `%${opts.location}%`)
  }

  if (opts.remote && opts.remote !== 'any') {
    if (opts.remote === 'remote_only') q = q.eq('is_remote', true)
    else if (opts.remote === 'onsite_ok') q = q.eq('is_remote', false)
  }

  if (opts.seniority) {
    q = q.eq('seniority', opts.seniority)
  }

  if (opts.job_type) {
    q = q.eq('job_type', opts.job_type)
  }

  if (opts.salary_min) {
    q = q.gte('salary_max', opts.salary_min)
  }

    if (opts.keywords && opts.keywords.length > 0) {
    const searchTerms = opts.keywords.join(' | ')
    q = q.textSearch('fts', searchTerms)
  }

  const { data, error } = await q

  if (error) throw error

  const jobs = (data ?? []) as unknown as Job[]
  const cursor = jobs.length > 0 ? String(jobs[jobs.length - 1].posted_at || jobs[jobs.length - 1].created_at) : null
  const has_more = jobs.length === (opts.limit ?? 20)

  return { data: jobs, cursor, has_more }
}

export async function getJobById(id: string): Promise<Job | null> {
  const { data } = await supabase.from('jobs').select('*').eq('id', id).single()
  return data as unknown as Job | null
}

export async function getSavedJobs(userId: string): Promise<SavedJob[]> {
  const { data } = await supabase
    .from('saved_jobs')
    .select('*, job:jobs(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as SavedJob[]
}

export async function saveJob(userId: string, jobId: string, state: 'saved' | 'dismissed') {
  const { error } = await supabase.from('saved_jobs').upsert(
    { user_id: userId, job_id: jobId, state },
    { onConflict: 'user_id, job_id' },
  )
  return { error }
}

export async function deleteSavedJob(userId: string, jobId: string) {
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('user_id', userId)
    .eq('job_id', jobId)
  return { error }
}

export async function getSearchProfile(userId: string): Promise<SearchProfile | null> {
  const { data } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as unknown as SearchProfile | null
}

// ---- Applications ----

export async function getApplications(
  userId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ data: Application[]; cursor: string | null; has_more: boolean }> {
  let q = supabase
    .from('applications')
    .select('*, job:jobs(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20)

  if (opts.cursor) {
    q = q.lt('created_at', opts.cursor)
  }

  const { data, error } = await q
  if (error) throw error

  const applications = (data ?? []) as unknown as Application[]
  const cursor = applications.length > 0 ? applications[applications.length - 1].created_at : null
  const has_more = applications.length === (opts.limit ?? 20)

  return { data: applications, cursor, has_more }
}

export async function createApplication(
  userId: string,
  jobId: string,
  method: 'manual' | 'auto',
  optimizedCvId?: string,
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      job_id: jobId,
      method,
      optimized_cv_id: optimizedCvId ?? null,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as Application
}

// ---- Optimized CVs ----

export async function getOptimizedCVs(jobId: string, userId: string): Promise<any[]> {
  const { data } = await supabase
    .from('optimized_cvs')
    .select('*, base_resume:base_resumes!inner(*)')
    .eq('job_id', jobId)
    .eq('base_resumes.user_id', userId)
    .order('version', { ascending: false })

  return data ?? []
}

export async function approveOptimizedCV(id: string): Promise<void> {
  const { error } = await supabase
    .from('optimized_cvs')
    .update({ user_approved: true })
    .eq('id', id)

  if (error) throw error
}

// ---- Base Resumes ----

export async function getBaseResumes(userId: string): Promise<BaseResume[]> {
  const { data } = await supabase
    .from('base_resumes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as BaseResume[]
}

// ---- Auto-Apply Audit ----

export async function getApplicationWithAudit(id: string): Promise<{ application: Application | null; logs: ApplicationAuditLog[] }> {
  const { data: app } = await supabase
    .from('applications')
    .select('*, job:jobs(*)')
    .eq('id', id)
    .single()

  const { data: logs } = await supabase
    .from('application_audit_logs')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: true })

  return {
    application: (app ?? null) as unknown as Application | null,
    logs: (logs ?? []) as unknown as ApplicationAuditLog[],
  }
}

export async function addAuditLog(
  applicationId: string,
  step: string,
  fieldValues?: Record<string, any>,
) {
  const { error } = await supabase
    .from('application_audit_logs')
    .insert({
      application_id: applicationId,
      step,
      field_values: fieldValues ?? null,
    })

  if (error) throw error
}

export async function updateApplicationStatus(
  id: string,
  status: 'submitted' | 'failed' | 'ambiguous' | 'user_abandoned',
) {
  const { error } = await supabase
    .from('applications')
    .update({
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : undefined,
    })
    .eq('id', id)

  if (error) throw error
}

export async function getLatestOptimizedCV(
  jobId: string,
  userId: string,
): Promise<any | null> {
  const cvs = await getOptimizedCVs(jobId, userId)
  return cvs[0] ?? null
}

// ---- Base Resumes ----

export async function uploadResume(
  userId: string,
  file: File,
): Promise<BaseResume> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload-resume', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Upload failed')
  }

  const data = await res.json()
  return data.resume as BaseResume
}
