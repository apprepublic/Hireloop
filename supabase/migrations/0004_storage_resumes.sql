-- ============================================================
-- HireLoop v1 — Resume Storage Bucket & Policies
-- ============================================================

-- 1. Create storage bucket for resumes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  true,
  10485760,  -- 10MB
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- 2. RLS: authenticated users can upload their own files
create policy "Users can upload resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. RLS: authenticated users can read their own files (and anyone can read public)
create policy "Users can read own resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. RLS: authenticated users can delete their own files
create policy "Users can delete own resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
