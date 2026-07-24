import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest, validate, ok, err } from '@/lib/api-helpers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'edge'

const BodySchema = z.object({
  job_id: z.string().uuid(),
  criteria: z.any().optional(),
})

function buildScorePrompt(job: any, criteria?: any) {
  return `You are a job-match evaluator. Score how well this job aligns with the candidate's search criteria.

Return valid JSON only: { "score": number 0-100, "reasoning": string, "breakdown": { "title": number, "description": number, "seniority": number, "location": number, "salary": number } }

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${(job.description || '').slice(0, 1500)}
Location: ${job.location || 'N/A'}
Remote: ${job.is_remote ? 'Yes' : 'No'}
Seniority: ${job.seniority || 'Not specified'}
Salary: ${job.salary_min || '?'} - ${job.salary_max || '?'} ${job.currency || 'USD'}
Job type: ${job.job_type || 'Not specified'}

${criteria ? `CANDIDATE CRITERIA:\n${JSON.stringify(criteria, null, 2)}` : 'CANDIDATE CRITERIA: General job search (no specific criteria provided)'}

RULES:
- Score 0-100, higher = better match
- Evaluate title relevance, description alignment, seniority fit, location/remote fit, salary alignment
- Be critical — not every job is a good match
- Provide 1-2 sentence reasoning
- If no specific criteria provided, score based on job completeness and broad appeal`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return err('Unauthorized', 401)
    if (!process.env.OPENROUTER_API_KEY) return err('OpenRouter not configured', 503)

    const body = await request.json().catch(() => ({}))
    const parsed = validate(BodySchema, body)
    if (parsed.error) return parsed.error
    const input = parsed.data

    const job = await getSupabaseAdmin()
      .from('jobs')
      .select('*')
      .eq('id', input.job_id)
      .single()
      .then((r) => r.data)

    if (!job) return err('Job not found', 404)

    const prompt = buildScorePrompt(job, input.criteria)
    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'HireLoop',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a job-match evaluator. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      return err(`AI error: ${errText}`, 502)
    }

    const llmData = await llmRes.json()
    const content = llmData.choices?.[0]?.message?.content
    if (!content) return err('Empty AI response', 502)

    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
    let result: any
    try {
      result = JSON.parse(cleaned)
    } catch {
      return err('Failed to parse AI response', 502)
    }

    return ok({
      job_id: job.id,
      ml_score: Math.round(Math.max(0, Math.min(100, result.score || 0))),
      reasoning: result.reasoning || '',
      breakdown: result.breakdown || {},
    })
  } catch (e: any) {
    console.error('Match score error:', e)
    return err(e.message || 'Internal error', 500)
  }
}
