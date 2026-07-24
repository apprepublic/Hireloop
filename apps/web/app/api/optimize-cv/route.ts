import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const openRouterKey = process.env.OPENROUTER_API_KEY

async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data, error } = await anonClient.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, token }
}

function buildPrompt(baseResume: any, job: any) {
  return `You are a professional resume writer. Tailor the following resume for the specific job below.

RULES:
- You may rephrase, reorder, and emphasize existing content.
- You MUST NOT invent employers, dates, titles, degrees, or skills not present in the base resume.
- If the resume lacks relevant experience for a job requirement, honestly reflect what is there — never fabricate.
- Keep the same sections: contact, summary, experience, education, skills.
- Output valid JSON only, matching this structure:
{
  "summary": "string",
  "experience": [{ "company": "string", "title": "string", "start_date": "string", "end_date": "string | null", "description": "string" }],
  "education": [{ "institution": "string", "degree": "string", "field": "string", "start_date": "string", "end_date": "string | null" }],
  "skills": ["string"]
}

BASE RESUME (current content):
${JSON.stringify(baseResume.parsed_sections, null, 2)}

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Return only the JSON, no markdown, no explanation.`
}

function extractTerms(sections: any): Set<string> {
  const terms = new Set<string>()
  if (!sections) return terms

  if (sections.skills) sections.skills.forEach((s: string) => terms.add(s.toLowerCase()))
  if (sections.experience) {
    sections.experience.forEach((e: any) => {
      if (e.company) terms.add(e.company.toLowerCase())
      if (e.title) terms.add(e.title.toLowerCase())
      if (e.description) {
        e.description.split(/\s+/).forEach((w: string) => {
          if (w.length > 3) terms.add(w.toLowerCase().replace(/[^a-z0-9]/g, ''))
        })
      }
    })
  }
  if (sections.education) {
    sections.education.forEach((e: any) => {
      if (e.institution) terms.add(e.institution.toLowerCase())
      if (e.degree) terms.add(e.degree.toLowerCase())
    })
  }
  return terms
}

function findFlaggedTerms(generated: any, baseTerms: Set<string>): string[] {
  const flagged: string[] = []
  const generatedTerms = extractTerms(generated)

  generatedTerms.forEach((term: string) => {
    if (!baseTerms.has(term) && term.length > 3) {
      flagged.push(term)
    }
  })

  return flagged
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!openRouterKey) {
      return NextResponse.json({ error: 'OpenRouter not configured' }, { status: 503 })
    }

    const { base_resume_id, job_id } = await request.json()
    if (!base_resume_id || !job_id) {
      return NextResponse.json({ error: 'base_resume_id and job_id are required' }, { status: 400 })
    }

    const resume = await supabaseAdmin
      .from('base_resumes')
      .select('*')
      .eq('id', base_resume_id)
      .single()
      .then((r) => r.data)

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (resume.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!resume.parsed_sections) {
      return NextResponse.json({ error: 'Resume has not been parsed yet' }, { status: 400 })
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

    const prompt = buildPrompt(resume, job)

    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'HireLoop',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional resume writer. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      console.error('OpenRouter error:', llmResponse.status, errText)
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }

    const llmData = await llmResponse.json()
    const content = llmData.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    }

    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
    let generatedSections: any
    try {
      generatedSections = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    const baseTerms = extractTerms(resume.parsed_sections)
    const flaggedTerms = findFlaggedTerms(generatedSections, baseTerms)

    const { data: existing } = await supabaseAdmin
      .from('optimized_cvs')
      .select('version')
      .eq('base_resume_id', base_resume_id)
      .eq('job_id', job_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const version = (existing?.version ?? 0) + 1

    const { data: optimized, error: insertError } = await supabaseAdmin
      .from('optimized_cvs')
      .insert({
        base_resume_id,
        job_id,
        version,
        generated_sections: generatedSections,
        flagged_terms: flaggedTerms,
        user_approved: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save optimized CV' }, { status: 500 })
    }

    return NextResponse.json({
      id: optimized.id,
      version: optimized.version,
      generated_sections: generatedSections,
      flagged_terms: flaggedTerms,
      created_at: optimized.created_at,
    })
  } catch (err: any) {
    console.error('Optimize CV error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
