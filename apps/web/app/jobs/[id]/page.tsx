'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getJobById, createApplication } from '@/lib/queries'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import type { Job } from '@hireloop/shared'

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    if (!params.id) return
    setLoading(true)
    getJobById(params.id as string)
      .then((data) => setJob(data))
      .finally(() => setLoading(false))
  }, [params.id])

  const handleApply = async () => {
    if (!job || !user) return
    setApplying(true)
    try {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer')
      await createApplication(user.id, job.id, 'manual')
      setApplied(true)
    } catch (e) {
      console.error('Failed to track application', e)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" onClick={() => router.push('/feed')}>
          Back to feed
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to feed
          </Link>
          <Link href="/applications" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            My applications
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                job.source_id === 'linkedin_unofficial'
                  ? 'bg-amber-100 text-amber-700'
                  : job.source_id === 'adzuna'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
              }`}>
                {job.source_id === 'linkedin_unofficial' ? 'LinkedIn' : job.source_id.charAt(0).toUpperCase() + job.source_id.slice(1)}
              </span>
              {job.match_score > 0 && (
                <span className="text-xs text-primary font-medium">{job.match_score}% match</span>
              )}
              {job.auto_apply_eligible && (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  Auto-apply eligible
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className="text-lg text-muted-foreground">{job.company}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {job.location && <span>{job.location}</span>}
            {job.is_remote && <span className="text-green-600 font-medium">Remote</span>}
            {(job.salary_min || job.salary_max) && (
              <span>
                {job.salary_min && job.salary_max
                  ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
                  : job.salary_min
                    ? `From $${job.salary_min.toLocaleString()}`
                    : `Up to $${job.salary_max!.toLocaleString()}`}
              </span>
            )}
            {job.job_type && <span>{job.job_type.replace('_', ' ')}</span>}
            {job.seniority && <span>{job.seniority}</span>}
            {job.posted_at && (
              <span>{new Date(job.posted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-line">{job.description}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
            <Button onClick={handleApply} disabled={applying || applied}>
              {applied ? 'Applied!' : applying ? 'Opening...' : `Apply on ${job.source_id === 'linkedin_unofficial' ? 'LinkedIn' : job.source_id.charAt(0).toUpperCase() + job.source_id.slice(1)}`}
            </Button>
            {job.auto_apply_eligible && (
              <Button variant="secondary" onClick={() => router.push(`/jobs/${job.id}/auto-apply`)}>
                Auto-apply
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push(`/jobs/${job.id}/optimize`)}>
              Optimize CV for this job
            </Button>
          </div>

          {applied && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
              Application tracked.{' '}
              <Link href="/applications" className="underline font-medium">View all applications</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
