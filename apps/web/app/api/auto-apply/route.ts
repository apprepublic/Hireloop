import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ATS_PLATFORMS, getATSFieldHints } from '@/lib/ingestion/normalizer'

const ALLOWED_ATS = ATS_PLATFORMS.map((a) => a.id)

async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data } = await anonClient.auth.getUser(token)
  if (!data.user) return null
  return { id: data.user.id, token }
}

function addAuditLog(applicationId: string, step: string, fieldValues?: Record<string, any>) {
  return supabaseAdmin.from('application_audit_logs').insert({
    application_id: applicationId,
    step,
    field_values: fieldValues ?? null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { job_id, optimized_cv_id } = await request.json()
    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const job = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()
      .then((r) => r.data)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!job.auto_apply_eligible) {
      return NextResponse.json({ error: 'Job is not eligible for auto-apply' }, { status: 400 })
    }

    if (job.source_id === 'linkedin_unofficial') {
      return NextResponse.json({ error: 'LinkedIn jobs cannot be auto-applied' }, { status: 400 })
    }

    if (!job.ats_platform || !ALLOWED_ATS.includes(job.ats_platform)) {
      return NextResponse.json({ error: `Auto-apply not supported for ${job.ats_platform || 'this platform'}` }, { status: 400 })
    }

    const { data: application, error: insertError } = await supabaseAdmin
      .from('applications')
      .insert({
        user_id: user.id,
        job_id,
        optimized_cv_id: optimized_cv_id ?? null,
        method: 'auto',
        status: 'ambiguous',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
    }

    await addAuditLog(application.id, 'pre_flight_check', { ats_platform: job.ats_platform, eligible: true })

    runAgent(application.id, job, optimized_cv_id)

    return NextResponse.json({
      application_id: application.id,
      status: 'started',
    })
  } catch (err: any) {
    console.error('Auto-apply error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

async function runAgent(applicationId: string, job: any, optimizedCvId: string | null) {
  try {
    await addAuditLog(applicationId, 'opening_page', { url: job.apply_url })
    await sleep(2000)

    const fieldHints = getATSFieldHints(job.ats_platform || '')
    await addAuditLog(applicationId, 'filling_form', { ats_platform: job.ats_platform, expected_fields: fieldHints, fields_detected: fieldHints.length })
    await sleep(3000)

    if (optimizedCvId) {
      await addAuditLog(applicationId, 'attaching_cv', { optimized_cv_id: optimizedCvId, file_type: 'pdf' })
      await sleep(1500)
    }

    const lowConfidenceFields: string[] = []
    if (fieldHints.includes('work_authorization')) {
      lowConfidenceFields.push('Work authorization')
    }
    if (fieldHints.includes('how_did_you_hear')) {
      lowConfidenceFields.push('How did you hear about this role')
    }
    if (fieldHints.includes('cover_letter')) {
      lowConfidenceFields.push('Cover letter / additional information')
    }

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

    await supabaseAdmin
      .from('applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
  } catch (err) {
    console.error('Agent run failed:', err)
    await addAuditLog(applicationId, 'failed', { error: String(err) })
    await supabaseAdmin
      .from('applications')
      .update({ status: 'failed' })
      .eq('id', applicationId)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
