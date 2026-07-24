import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserFromRequest, err } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return err('No file provided', 400)

  const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowedMimes.includes(file.type)) return err('Only PDF and DOCX files are allowed', 400)

  if (file.size > 10 * 1024 * 1024) return err('File must be under 10MB', 400)

  const fileExt = file.name.split('.').pop()
  const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await getSupabaseAdmin().storage
    .from('resumes')
    .upload(filePath, new Uint8Array(bytes), {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    if (uploadError.message?.includes('bucket')) {
      return err('Storage bucket not configured', 500)
    }
    return err(uploadError.message, 500)
  }

  const { data: urlData } = getSupabaseAdmin().storage.from('resumes').getPublicUrl(filePath)

  const { data, error: dbError } = await getSupabaseAdmin()
    .from('base_resumes')
    .insert({
      user_id: user.id,
      file_url: urlData.publicUrl,
      file_type: fileExt === 'pdf' ? 'pdf' : 'docx',
      parsed_sections: null,
    })
    .select()
    .single()

  if (dbError) {
    await getSupabaseAdmin().storage.from('resumes').remove([filePath])
    return err(dbError.message, 500)
  }

  return NextResponse.json({ resume: data })
}
