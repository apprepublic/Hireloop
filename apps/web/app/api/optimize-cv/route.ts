import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest, validate, ok, err } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BodySchema = z.object({
  base_resume_id: z.string().uuid(),
  job_id: z.string().uuid(),
})

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
    if (!baseTerms.has(term) && term.length > 3) flagged.push(term)
  })
  return flagged
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return err('Unauthorized', 401)

    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) return err('OpenRouter not configured', 503)

    const body = await request.json().catch(() => ({}))
    const parsed = validate(BodySchema, body)
    if (parsed.error) return parsed.error
    const input = parsed.data

    const resume = await supabaseAdmin
      .from('base_resumes')
      .select('*')
      .eq('id', input.base_resume_id)
      .single()
      .then((r) => r.data)

    if (!resume) return err('Resume not found', 404)
    if (resume.user_id !== user.id) return err('Forbidden', 403)
    if (!resume.parsed_sections) return err('Resume has not been parsed yet', 400)

    const job = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', input.job_id)
      .single()
      .then((r) => r.data)

    if (!job) return err('Job not found', 404)

    const prompt = buildPrompt(resume, job)
    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
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

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      console.error('OpenRouter error:', llmRes.status, errText)
      return err('AI service error', 502)
    }

    const llmData = await llmRes.json()
    const content = llmData.choices?.[0]?.message?.content
    if (!content) return err('Empty AI response', 502)

    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
    let generatedSections: any
    try {
      generatedSections = JSON.parse(cleaned)
    } catch {
      return err('Failed to parse AI response', 502)
    }

    const baseTerms = extractTerms(resume.parsed_sections)
    const flaggedTerms = findFlaggedTerms(generatedSections, baseTerms)

    const { data: existing } = await supabaseAdmin
      .from('optimized_cvs')
      .select('version')
      .eq('base_resume_id', input.base_resume_id)
      .eq('job_id', input.job_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const version = (existing?.version ?? 0) + 1

    const { data: optimized, error: insertError } = await supabaseAdmin
      .from('optimized_cvs')
      .insert({
        base_resume_id: input.base_resume_id,
        job_id: input.job_id,
        version,
        generated_sections: generatedSections,
        flagged_terms: flaggedTerms,
        user_approved: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return err('Failed to save optimized CV', 500)
    }

    return ok({
      id: optimized.id,
      version: optimized.version,
      generated_sections: generatedSections,
      flagged_terms: flaggedTerms,
      created_at: optimized.created_at,
    })
  } catch (err: any) {
    console.error('Optimize CV error:', err)
    return err(err.message || 'Internal error', 500)
  }
}
