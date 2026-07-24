'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { getJobById, getLatestOptimizedCV } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { Job, ApplicationAuditLog } from '@hireloop/shared'

const STEP_LABELS: Record<string, string> = {
  pre_flight_check: 'Checking eligibility',
  opening_page: 'Opening application page',
  filling_form: 'Filling in your details',
  attaching_cv: 'Attaching your CV',
  awaiting_input: 'Needs your input',
  confirmed: 'Final confirmation',
  submitted: 'Submitted!',
  failed: 'Failed',
}

const STEP_ORDER = ['pre_flight_check', 'opening_page', 'filling_form', 'attaching_cv', 'awaiting_input', 'confirmed', 'submitted']

export default function AutoApplyPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [optimizedCvId, setOptimizedCvId] = useState<string | null>(null)
  const [step, setStep] = useState<'consent' | 'running' | 'done' | 'error'>('consent')
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [logs, setLogs] = useState<ApplicationAuditLog[]>([])
  const [finalStatus, setFinalStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!params.id || !user) return
    getJobById(params.id as string).then(setJob)
    getLatestOptimizedCV(params.id as string, user.id).then((cv) => {
      if (cv?.user_approved) setOptimizedCvId(cv.id)
    })
  }, [params.id, user])

  const pollStatus = useCallback(async (appId: string) => {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    if (!token) return

    try {
      const res = await fetch(`/api/auto-apply/${appId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        if (data.application?.status === 'submitted') {
          setFinalStatus('submitted')
          setStep('done')
          if (pollingRef.current) clearInterval(pollingRef.current)
        } else if (data.application?.status === 'failed') {
          setFinalStatus('failed')
          setStep('error')
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      }
    } catch {}
  }, [])

  const handleStart = async () => {
    if (!user || !params.id) return
    setSubmitting(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const res = await fetch('/api/auto-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_id: params.id,
          optimized_cv_id: optimizedCvId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start')
      }

      setApplicationId(data.application_id)
      setStep('running')

      pollingRef.current = setInterval(() => pollStatus(data.application_id), 1500)
    } catch (err: any) {
      setFinalStatus(err.message)
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const currentStep = logs.length > 0
    ? STEP_ORDER.find((s) => !logs.find((l) => l.step === s)) || 'submitted'
    : 'pre_flight_check'

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={`/jobs/${params.id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to job
          </Link>
          <h1 className="font-semibold">Auto-apply</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {step === 'consent' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-bold">Review before auto-apply</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Job</span>
                  <span className="font-medium text-right">{job.title} — {job.company}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium capitalize">{job.ats_platform || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">CV version</span>
                  <span className="font-medium">{optimizedCvId ? 'Optimized CV' : 'Base resume'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Data submitted</span>
                  <span className="font-medium">Name, email, CV, standard fields</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                The AI agent will open the application page, fill in the form using your profile data and CV, and submit.
                You will be able to review any low-confidence fields before final submission.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleStart} disabled={submitting}>
                {submitting ? 'Starting...' : 'Confirm & start auto-apply'}
              </Button>
              <Button variant="outline" onClick={() => router.push(`/jobs/${params.id}`)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(step === 'running' || step === 'done') && (
          <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-lg font-bold text-center">
              {step === 'done' ? 'Application complete' : 'Applying...'}
            </h2>

            <div className="space-y-3">
              {STEP_ORDER.filter((s) => s !== 'failed').map((s) => {
                const log = logs.find((l) => l.step === s)
                const isActive = s === currentStep
                const isDone = !!log

                return (
                  <div
                    key={s}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isDone
                        ? 'border-green-200 bg-green-50'
                        : isActive
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-card opacity-50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'border-2 border-primary'
                          : 'border-2 border-muted-foreground'
                    }`}>
                      {isDone ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDone ? 'text-green-700' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {STEP_LABELS[s] || s}
                      </p>
                      {isActive && !isDone && (
                        <p className="text-xs text-muted-foreground mt-0.5">In progress...</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {step === 'done' && (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
                  <p className="font-medium">
                    {finalStatus === 'submitted' ? 'Application submitted successfully!' : 'Application recorded'}
                  </p>
                  <p className="text-sm mt-1">
                    {finalStatus === 'submitted'
                      ? 'The agent has completed and submitted the application on your behalf.'
                      : 'Status: ' + finalStatus}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={() => router.push('/applications')}>
                    View all applications
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/feed')}>
                    Back to feed
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'error' && (
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
              <p className="font-medium">Auto-apply failed</p>
              <p className="text-sm mt-1">{finalStatus || 'An unexpected error occurred.'}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You can still apply manually by visiting the original job posting.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                  Apply manually
                </a>
              </Button>
              <Button variant="outline" onClick={() => router.push(`/jobs/${params.id}`)}>
                Back to job
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
