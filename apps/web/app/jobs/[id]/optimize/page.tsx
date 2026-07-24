'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { getJobById, getBaseResumes, getOptimizedCVs, approveOptimizedCV } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import type { Job, BaseResume } from '@hireloop/shared'

export default function OptimizeCVPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [resumes, setResumes] = useState<BaseResume[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'side-by-side' | 'changes'>('side-by-side')

  useEffect(() => {
    if (!params.id || !user) return
    getJobById(params.id as string).then(setJob)
    getBaseResumes(user.id).then((r) => {
      setResumes(r)
      if (r.length > 0) setSelectedResumeId(r[0].id)
    })
  }, [params.id, user])

  const handleOptimize = async () => {
    if (!selectedResumeId || !params.id || !user) return
    setOptimizing(true)
    setError(null)
    setResult(null)

    try {
      const existingCvs = await getOptimizedCVs(params.id as string, user.id)
      if (existingCvs.length > 0) {
        const cv = existingCvs[0] as any
        setResult({
          id: cv.id,
          version: cv.version,
          generated_sections: cv.generated_sections,
          flagged_terms: cv.flagged_terms,
          user_approved: cv.user_approved,
          created_at: cv.created_at,
        })
        setOptimizing(false)
        return
      }

      const { data: session } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const token = session?.session?.access_token

      const res = await fetch('/api/optimize-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_resume_id: selectedResumeId,
          job_id: params.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Optimization failed')
      }
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOptimizing(false)
    }
  }

  const handleApprove = async () => {
    if (!result?.id) return
    await approveOptimizedCV(result.id)
    setResult((prev: any) => ({ ...prev, user_approved: true }))
  }

  const baseResume = resumes.find((r) => r.id === selectedResumeId)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={`/jobs/${params.id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to job
          </Link>
          <h1 className="font-semibold">Optimize CV</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!job ? (
          <div className="text-center py-12 text-muted-foreground">Loading job...</div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold">{job.title}</h2>
              <p className="text-muted-foreground">{job.company}</p>
            </div>

            {resumes.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <p className="text-muted-foreground mb-4">Upload a resume first to optimize it.</p>
                <Button onClick={() => router.push('/resume')}>Upload resume</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Base resume:</label>
                  <select
                    value={selectedResumeId || ''}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.file_url.split('/').pop()} — {new Date(r.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleOptimize} disabled={optimizing || !selectedResumeId}>
                    {optimizing ? 'Optimizing...' : result ? 'Regenerate' : 'Generate tailored CV'}
                  </Button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
                )}

                {optimizing && (
                  <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Analyzing job description and tailoring your resume...</p>
                  </div>
                )}

                {result && !optimizing && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Version {result.version}</span>
                        {result.flagged_terms?.length > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {result.flagged_terms.length} term{result.flagged_terms.length > 1 ? 's' : ''} flagged
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('side-by-side')}
                        >
                          Side by side
                        </Button>
                        <Button
                          variant={viewMode === 'changes' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('changes')}
                        >
                          Changes only
                        </Button>
                      </div>
                    </div>

                    {result.flagged_terms?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-amber-800 mb-2">Flagged terms — review carefully</p>
                        <p className="text-xs text-amber-700 mb-2">
                          These terms in the generated CV could not be traced back to your base resume:
                        </p>
                        <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                          {result.flagged_terms.map((term: string, i: number) => (
                            <li key={i}>{term}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {viewMode === 'side-by-side' && baseResume?.parsed_sections && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Base resume</h3>
                          <ResumePreview sections={baseResume.parsed_sections} />
                        </div>
                      )}
                      <div className={viewMode === 'changes' ? 'lg:col-span-2' : ''}>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                          {viewMode === 'changes' ? 'Tailored CV (changes highlighted)' : 'Tailored CV'}
                        </h3>
                        <ResumePreview sections={result.generated_sections} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      {!result.user_approved ? (
                        <Button onClick={handleApprove}>
                          Approve & use this CV
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approved
                        </div>
                      )}
                      <Button variant="outline" onClick={() => router.push(`/jobs/${params.id}`)}>
                        Back to job
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ResumePreview({ sections }: { sections: any }) {
  if (!sections) return <p className="text-muted-foreground text-sm">No content</p>

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4 text-sm">
      {sections.summary && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Summary</h4>
          <p>{sections.summary}</p>
        </div>
      )}

      {sections.experience?.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Experience</h4>
          <div className="space-y-3">
            {sections.experience.map((exp: any, i: number) => (
              <div key={i}>
                <p className="font-medium">{exp.title}</p>
                <p className="text-muted-foreground">{exp.company}</p>
                <p className="text-xs text-muted-foreground">
                  {exp.start_date} — {exp.end_date || 'Present'}
                </p>
                <p className="mt-1 whitespace-pre-line">{exp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.education?.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Education</h4>
          <div className="space-y-2">
            {sections.education.map((edu: any, i: number) => (
              <div key={i}>
                <p className="font-medium">{edu.degree} in {edu.field}</p>
                <p className="text-muted-foreground">{edu.institution}</p>
                <p className="text-xs text-muted-foreground">
                  {edu.start_date} — {edu.end_date || 'Present'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.skills?.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {sections.skills.map((skill: string, i: number) => (
              <span key={i} className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
