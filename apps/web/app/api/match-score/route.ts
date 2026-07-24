import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data } = await anonClient.auth.getUser(token)
  if (!data.user) return null
  return data.user
}

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
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter not configured' }, { status: 503 })
    }

    const { job_id, criteria } = await request.json()
    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
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

    const prompt = buildScorePrompt(job, criteria)

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
      return NextResponse.json({ error: `AI error: ${errText}` }, { status: 502 })
    }

    const llmData = await llmRes.json()
    const content = llmData.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    }

    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
    let result: any
    try {
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    return NextResponse.json({
      job_id: job.id,
      ml_score: Math.round(Math.max(0, Math.min(100, result.score || 0))),
      reasoning: result.reasoning || '',
      breakdown: result.breakdown || {},
    })
  } catch (err: any) {
    console.error('Match score error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
