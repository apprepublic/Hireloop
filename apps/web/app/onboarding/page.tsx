'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { SourceId, SearchProfile } from '@hireloop/shared'

type Step = 'titles' | 'location' | 'seniority' | 'sources'

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [step, setStep] = useState<Step>('titles')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [remotePref, setRemotePref] = useState<string>('any')
  const [seniority, setSeniority] = useState('')
  const [jobType, setJobType] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [sources, setSources] = useState<SourceId[]>(['adzuna', 'jooble'])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [existingProfile, setExistingProfile] = useState<SearchProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('search_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const p = data as unknown as SearchProfile
          setExistingProfile(p)
          setKeywords(p.title_keywords)
          setLocation(p.location || '')
          setRemotePref(p.remote_preference)
          setSeniority(p.seniority || '')
          setJobType(p.job_type || '')
          setSalaryMin(p.salary_min ? String(p.salary_min) : '')
          setSources(p.enabled_sources)
        }
      })
      .finally(() => setLoadingProfile(false))
  }, [user])

  const addKeyword = () => {
    const trimmed = keywordInput.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const toggleSource = (source: SourceId) => {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    )
  }

  const stepIndex: Record<Step, number> = { titles: 0, location: 1, seniority: 2, sources: 3 }
  const totalSteps = 4
  const progress = ((stepIndex[step] + 1) / totalSteps) * 100

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)

    const payload = {
      title_keywords: keywords,
      location: location || null,
      remote_preference: remotePref,
      seniority: seniority || null,
      salary_min: salaryMin ? parseInt(salaryMin) : null,
      job_type: jobType || null,
      enabled_sources: sources,
    }

    let error: any = null
    if (existingProfile) {
      const { error: e } = await supabase
        .from('search_profiles')
        .update(payload)
        .eq('id', existingProfile.id)
      error = e
    } else {
      const { error: e } = await supabase
        .from('search_profiles')
        .insert({ user_id: user.id, ...payload })
      error = e
    }

    setSaving(false)
    if (error) {
      setSaveError(error.message || 'Failed to save search profile')
    } else {
      router.push('/feed')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-lg">HireLoop</span>
        </div>
      </header>

      <div className="w-full bg-muted h-1">
        <div className="bg-primary h-1 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-12">
        {loadingProfile && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!loadingProfile && saveError && (
          <div className="bg-card border border-red-500/50 rounded-lg p-4 mb-6 text-sm text-red-600">
            {saveError}
          </div>
        )}

        {/* Step 1: Titles/Keywords */}
        {step === 'titles' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">What roles are you looking for?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter job titles or keywords. Add as many as you like.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder="e.g. Software Engineer"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button type="button" onClick={addKeyword} variant="outline">
                Add
              </Button>
            </div>

            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                  >
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-destructive">&times;</button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep('location')} disabled={keywords.length === 0}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Location & Remote */}
        {step === 'location' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Where do you want to work?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set your location preference.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Remote preference</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'any', label: 'Any' },
                  { value: 'remote_only', label: 'Remote only' },
                  { value: 'hybrid_ok', label: 'Hybrid OK' },
                  { value: 'onsite_ok', label: 'On-site OK' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRemotePref(opt.value)}
                    className={`px-4 py-3 rounded-md border text-sm text-left transition-colors ${
                      remotePref === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('titles')}>
                Back
              </Button>
              <Button onClick={() => setStep('seniority')}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Seniority & Job Type */}
        {step === 'seniority' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">What level and type?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Narrow down by experience level and employment type.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Seniority</label>
              <div className="grid grid-cols-2 gap-2">
                {['Entry', 'Mid', 'Senior', 'Lead', 'Manager', 'Director'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setSeniority(level === seniority ? '' : level)}
                    className={`px-4 py-3 rounded-md border text-sm text-left transition-colors ${
                      seniority === level
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background hover:bg-accent'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Job type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'full_time', label: 'Full-time' },
                  { value: 'part_time', label: 'Part-time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'internship', label: 'Internship' },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setJobType(type.value === jobType ? '' : type.value)}
                    className={`px-4 py-3 rounded-md border text-sm text-left transition-colors ${
                      jobType === type.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background hover:bg-accent'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('location')}>
                Back
              </Button>
              <Button onClick={() => setStep('sources')}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 4: Salary & Sources */}
        {step === 'sources' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Almost there</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set your salary expectation and choose job sources.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Minimum salary (optional)
              </label>
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Job sources</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-md border border-input cursor-pointer hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={sources.includes('adzuna')}
                    onChange={() => toggleSource('adzuna')}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Adzuna</span>
                    <p className="text-xs text-muted-foreground">Official API, licensed</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-md border border-input cursor-pointer hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={sources.includes('jooble')}
                    onChange={() => toggleSource('jooble')}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Jooble</span>
                    <p className="text-xs text-muted-foreground">Official API, licensed</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-md border border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100">
                  <input
                    type="checkbox"
                    checked={sources.includes('linkedin_unofficial')}
                    onChange={() => toggleSource('linkedin_unofficial')}
                    className="rounded mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">LinkedIn</span>
                    <p className="text-xs text-amber-700 mt-1">
                      Sourced via a third-party scraper, not an official API. Listings may be less current and this source carries higher data-freshness risk.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('seniority')}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving || sources.length === 0}>
                {saving ? 'Saving...' : 'Start browsing jobs'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
