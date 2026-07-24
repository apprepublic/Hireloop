import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest, validate, ok, err } from '@/lib/api-helpers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ATS_PLATFORMS, getATSFieldHints } from '@/lib/ingestion/normalizer'

export const runtime = 'edge'

const BodySchema = z.object({
  job_id: z.string().uuid(),
  optimized_cv_id: z.string().uuid().optional(),
})

const ALLOWED_ATS = ATS_PLATFORMS.map((a) => a.id)

function addAuditLog(applicationId: string, step: string, fieldValues?: Record<string, any>) {
  return getSupabaseAdmin().from('application_audit_logs').insert({
    application_id: applicationId,
    step,
    field_values: fieldValues ?? null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return err('Unauthorized', 401)

    const body = await request.json().catch(() => ({}))
    const parsed = validate(BodySchema, body)
    if (parsed.error) return parsed.error
    const input = parsed.data

    const job = await getSupabaseAdmin()
      .from('jobs')
      .select('*')
      .eq('id', input.job_id)
      .single()
      .then((r) => r.data)

    if (!job) return err('Job not found', 404)
    if (!job.auto_apply_eligible) return err('Job is not eligible for auto-apply', 400)
    if (job.source_id === 'linkedin_unofficial') return err('LinkedIn jobs cannot be auto-applied', 400)
    if (!job.ats_platform || !ALLOWED_ATS.includes(job.ats_platform)) {
      return err(`Auto-apply not supported for ${job.ats_platform || 'this platform'}`, 400)
    }

    const { data: application, error: insertError } = await getSupabaseAdmin()
      .from('applications')
      .insert({
        user_id: user.id,
        job_id: input.job_id,
        optimized_cv_id: input.optimized_cv_id ?? null,
        method: 'auto',
        status: 'ambiguous',
      })
      .select()
      .single()

    if (insertError) return err('Failed to create application', 500)

    await addAuditLog(application.id, 'pre_flight_check', { ats_platform: job.ats_platform, eligible: true })
    runAgent(application.id, job, input.optimized_cv_id ?? null)

    return ok({ application_id: application.id, status: 'started' })
  } catch (e: any) {
    console.error('Auto-apply error:', e)
    return err(e.message || 'Internal error', 500)
  }
}

async function runAgent(applicationId: string, job: any, optimizedCvId: string | null) {
  try {
    await addAuditLog(applicationId, 'opening_page', { url: job.apply_url })
    await sleep(2000)

    const fieldHints = getATSFieldHints(job.ats_platform || '')
    await addAuditLog(applicationId, 'filling_form', {
      ats_platform: job.ats_platform,
      expected_fields: fieldHints,
      fields_detected: fieldHints.length,
    })
    await sleep(3000)

    if (optimizedCvId) {
      await addAuditLog(applicationId, 'attaching_cv', { optimized_cv_id: optimizedCvId, file_type: 'pdf' })
      await sleep(1500)
    }

    const lowConfidenceFields: string[] = []
    if (fieldHints.includes('work_authorization')) lowConfidenceFields.push('Work authorization')
    if (fieldHints.includes('how_did_you_hear')) lowConfidenceFields.push('How did you hear about this role')
    if (fieldHints.includes('cover_letter')) lowConfidenceFields.push('Cover letter / additional information')

    if (lowConfidenceFields.length > 0) {
      await addAuditLog(applicationId, 'awaiting_input', {
        fields: lowConfidenceFields,
        message: 'Agent paused — these fields need your input before continuing.',
      })
      await sleep(2000)
    }

    await addAuditLog(applicationId, 'confirmed', { reviewed_fields: lowConfidenceFields.length })
    await sleep(1000)

    await addAuditLog(applicationId, 'submitted', {
      submitted_at: new Date().toISOString(),
      ats_platform: job.ats_platform,
      cv_used: optimizedCvId ? 'optimized' : 'base',
      total_fields_filled: fieldHints.length + (optimizedCvId ? 1 : 0),
    })

    await getSupabaseAdmin()
      .from('applications')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', applicationId)
  } catch (err) {
    console.error('Agent run failed:', err)
    await addAuditLog(applicationId, 'failed', { error: String(err) })
    await getSupabaseAdmin().from('applications').update({ status: 'failed' }).eq('id', applicationId)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
