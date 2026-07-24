import { NextRequest } from 'next/server'
import { getUserFromRequest, ok, err } from '@/lib/api-helpers'
import { ingestAll } from '@/lib/ingestion'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return err('Unauthorized', 401)

    const results = await ingestAll()
    return ok({ results })
  } catch (e: any) {
    console.error('Ingestion error:', e)
    return err(e.message || 'Internal error', 500)
  }
}

export async function GET() {
  const config = {
    adzuna: !!process.env.ADZUNA_APP_ID && !!process.env.ADZUNA_API_KEY,
    jooble: !!process.env.JOOBLE_API_KEY,
    linkedin: !!process.env.APIFY_API_TOKEN && process.env.LINKEDIN_INGESTION_ENABLED === 'true',
    adzuna_country: process.env.ADZUNA_COUNTRY || 'gb',
    keywords: process.env.INGESTION_KEYWORDS || 'software engineer',
  }
  return ok({ config })
}
