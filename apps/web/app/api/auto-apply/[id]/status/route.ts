import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'edge'

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
  return data.user.id
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const app = await getSupabaseAdmin()
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .single()
    .then((r) => r.data)

  if (!app || app.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const logs = await getSupabaseAdmin()
    .from('application_audit_logs')
    .select('*')
    .eq('application_id', params.id)
    .order('created_at', { ascending: true })
    .then((r) => r.data ?? [])

  return NextResponse.json({
    application: app,
    logs,
  })
}
