'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { getBaseResumes, uploadResume } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import type { BaseResume } from '@hireloop/shared'

export default function ResumePage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [resumes, setResumes] = useState<BaseResume[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getBaseResumes(user.id)
      .then(setResumes)
      .finally(() => setLoading(false))
  }, [user])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setError(null)
    setUploading(true)
    try {
      const resume = await uploadResume(user.id, file)
      setResumes((prev) => [resume, ...prev])
    } catch (err: any) {
      if (err?.message?.includes('bucket') || err?.statusCode === '404') {
        setError('Storage bucket not configured. Contact support or check Supabase dashboard.')
      } else {
        setError(err?.message || 'Upload failed')
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to feed
          </Link>
          <h1 className="font-semibold">My resumes</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-8">
          <p className="text-sm text-muted-foreground mb-4">
            Upload your resume (PDF or DOCX, max 10MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleUpload}
            className="hidden"
            id="resume-upload"
          />
          <Button
            asChild
            disabled={uploading}
          >
            <label htmlFor="resume-upload" className="cursor-pointer">
              {uploading ? 'Uploading...' : 'Choose file'}
            </label>
          </Button>
          {error && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                <div className="h-5 w-1/2 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : resumes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No resumes uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium truncate">
                    {r.file_url.split('/').pop()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                    {r.parsed_sections ? ' — Parsed' : ' — Pending parse'}
                  </p>
                </div>
                {r.parsed_sections && (
                  <span className="text-xs text-green-600 font-medium">Ready</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
