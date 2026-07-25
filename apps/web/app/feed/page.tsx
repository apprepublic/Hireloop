'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { getJobs, getSearchProfile, getSavedJobs, saveJob, deleteSavedJob } from '@/lib/queries'
import { JobCard } from '@/components/jobs/job-card'
import { Button } from '@/components/ui/button'
import type { Job, SourceId, SearchProfile } from '@hireloop/shared'

export default function FeedPage() {
  const router = useRouter()
  const { user, profile, signOut } = useAuthStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchProfile, setSearchProfile] = useState<SearchProfile | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const loadJobs = useCallback(async (cursorVal?: string) => {
    if (!user || !searchProfile) return

    try {
      setError(null)
      const result = await getJobs({
        keywords: searchProfile.title_keywords,
        location: searchProfile.location || undefined,
        remote: searchProfile.remote_preference,
        seniority: searchProfile.seniority || undefined,
        salary_min: searchProfile.salary_min || undefined,
        job_type: searchProfile.job_type || undefined,
        sources: searchProfile.enabled_sources as SourceId[],
        cursor: cursorVal,
      })

      if (cursorVal) {
        setJobs((prev) => [...prev, ...result.data.filter((j) => !dismissedJobIds.has(j.id))])
      } else {
        setJobs(result.data.filter((j) => !dismissedJobIds.has(j.id)))
      }
      setCursor(result.cursor)
      setHasMore(result.has_more)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs')
    }
  }, [user, searchProfile, dismissedJobIds])

  useEffect(() => {
    if (!user) return
    getSearchProfile(user.id).then((profile) => {
      if (!profile) {
        router.push('/onboarding')
        return
      }
      setSearchProfile(profile)
    })
    getSavedJobs(user.id).then((saved) => {
      setSavedJobIds(new Set(saved.filter((s) => s.state === 'saved').map((s) => s.job_id)))
      setDismissedJobIds(new Set(saved.filter((s) => s.state === 'dismissed').map((s) => s.job_id)))
    })
  }, [user, router])

  useEffect(() => {
    if (!searchProfile) return
    setLoading(true)
    loadJobs().finally(() => setLoading(false))
  }, [searchProfile, loadJobs])

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true)
          loadJobs(cursor ?? undefined).finally(() => setLoadingMore(false))
        }
      },
      { threshold: 0.1 },
    )
    observerRef.current.observe(loadMoreRef.current)
    return () => observerRef.current?.disconnect()
  }, [cursor, hasMore, loadingMore, loadJobs])

  const handleSave = async (jobId: string) => {
    if (!user) return
    if (savedJobIds.has(jobId)) {
      await deleteSavedJob(user.id, jobId)
      setSavedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next })
    } else {
      await saveJob(user.id, jobId, 'saved')
      setSavedJobIds((prev) => new Set(prev).add(jobId))
    }
  }

  const handleDismiss = async (jobId: string) => {
    if (!user) return
    await saveJob(user.id, jobId, 'dismissed')
    setDismissedJobIds((prev) => new Set(prev).add(jobId))
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const hasSearchProfile = searchProfile !== null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg">HireLoop</h1>
          <div className="flex items-center gap-1 sm:gap-2">
            {hasSearchProfile && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding')}>
                Edit search
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push('/resume')}>
              Resume
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/applications')}>
              Applications
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:inline ml-2">
              {profile?.name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {!hasSearchProfile && loading ? null : !hasSearchProfile ? (
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">
              No search criteria set yet.
            </p>
            <Button onClick={() => router.push('/onboarding')}>
              Set up search criteria
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {searchProfile.title_keywords.slice(0, 3).join(', ')}
                {searchProfile.title_keywords.length > 3 && ' ...'}
              </h2>
              <span className="text-sm text-muted-foreground">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 w-16 bg-muted rounded mb-3" />
                    <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                    <div className="h-4 w-1/2 bg-muted rounded mb-3" />
                    <div className="h-3 w-2/3 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="border-2 border-dashed border-destructive/50 rounded-lg p-12 text-center">
                <p className="text-destructive font-medium mb-2">Error loading jobs</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button variant="outline" onClick={() => { setError(null); loadJobs() }}>
                  Retry
                </Button>
              </div>
            ) : jobs.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <p className="text-muted-foreground">
                  No jobs match your criteria. Try broadening your search.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding')}>
                  Edit search criteria
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    savedState={savedJobIds.has(job.id) ? 'saved' : null}
                    onSave={() => handleSave(job.id)}
                    onDismiss={() => handleDismiss(job.id)}
                    onSelect={() => router.push(`/jobs/${job.id}`)}
                  />
                ))}
              </div>
            )}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
            <div ref={loadMoreRef} className="h-4" />
          </div>
        )}
      </main>
    </div>
  )
}
