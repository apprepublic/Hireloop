'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { getApplications } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import type { Application } from '@hireloop/shared'

export default function ApplicationsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getApplications(user.id)
      .then((res) => setApplications(res.data))
      .finally(() => setLoading(false))
  }, [user])

  const statusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'ambiguous': return 'text-amber-600'
      case 'user_abandoned': return 'text-muted-foreground'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to feed
          </Link>
          <h1 className="font-semibold">My applications</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                <div className="h-4 w-1/2 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">No applications yet.</p>
            <Button onClick={() => router.push('/feed')}>
              Browse jobs
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/jobs/${app.job_id}`}
                      className="font-semibold hover:text-primary transition-colors"
                    >
                      {app.job?.title || 'Unknown job'}
                    </Link>
                    <p className="text-sm text-muted-foreground">{app.job?.company}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium capitalize ${statusColor(app.status)}`}>
                      {app.status}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{app.method}</p>
                  </div>
                </div>
                {app.submitted_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Applied {new Date(app.submitted_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                )}
                {app.optimized_cv_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Used optimized CV
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
