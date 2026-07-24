import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestAll } from '@/lib/ingestion'

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

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await ingestAll()

    return NextResponse.json({ results })
  } catch (err: any) {
    console.error('Ingestion error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  const config = {
    adzuna: !!process.env.ADZUNA_APP_ID && !!process.env.ADZUNA_API_KEY,
    jooble: !!process.env.JOOBLE_API_KEY,
    linkedin: !!process.env.APIFY_API_TOKEN && process.env.LINKEDIN_INGESTION_ENABLED === 'true',
    adzuna_country: process.env.ADZUNA_COUNTRY || 'gb',
  }

  return NextResponse.json({ config })
}
