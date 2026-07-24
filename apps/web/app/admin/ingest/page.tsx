'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { IngestionResult } from '@/lib/ingestion'

export default function AdminIngestPage() {
  const router = useRouter()
  const [results, setResults] = useState<IngestionResult[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [config, setConfig] = useState<Record<string, any> | null>(null)
  const [running, setRunning] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)

  useState(() => {
    fetch('/api/ingest')
      .then((r) => r.json())
      .then((d) => setConfig(d.config))
      .finally(() => setLoadingConfig(false))
  })

  const handleRun = async () => {
    setRunning(true)
    setResults(null)
    setApiError(null)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.error || `HTTP ${res.status}`)
        setResults(data.results || null)
      } else {
        setResults(data.results || [])
      }
    } catch (err: any) {
      setApiError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to feed
          </Link>
          <h1 className="font-semibold">Job Ingestion</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Source Configuration</h2>
          {loadingConfig ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : config ? (
            <div className="space-y-2 text-sm">
              {Object.entries(config).filter(([k]) => k !== 'adzuna_country' && k !== 'keywords').map(([key, enabled]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="capitalize">{key}</span>
                  <span className="text-muted-foreground">{enabled ? 'Configured' : 'Not configured'}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                Adzuna region: {config.adzuna_country}
              </p>
              <p className="text-xs text-muted-foreground">
                Keywords: {config.keywords}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleRun} disabled={running}>
              {running ? 'Running...' : 'Run ingestion now'}
            </Button>
          </div>
        </div>

        {apiError && (
          <div className="bg-card border border-red-500/50 rounded-lg p-6">
            <h2 className="font-semibold text-red-600 mb-2">Error</h2>
            <p className="text-sm text-red-600">{apiError}</p>
          </div>
        )}

        {results && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Results</h2>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="border border-border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{r.source}</span>
                    <span className="text-muted-foreground">
                      {r.fetched} fetched &middot; {r.inserted} inserted &middot; {r.updated} updated
                    </span>
                  </div>
                  {r.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      {r.errors.map((e, j) => <p key={j}>{e}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-2">Env vars needed</h2>
          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`ADZUNA_APP_ID        — https://developer.adzuna.com/
ADZUNA_API_KEY       — https://developer.adzuna.com/
ADZUNA_COUNTRY       — 'gb' (default), 'us', 'ca', etc.
JOOBLE_API_KEY       — https://jooble.org/api/about
APIFY_API_TOKEN      — https://console.apify.com/ (for LinkedIn)
LINKEDIN_INGESTION_ENABLED — 'true' to enable LinkedIn source
INGESTION_KEYWORDS   — search term (default: 'software engineer')`}
          </pre>
        </div>
      </main>
    </div>
  )
}
