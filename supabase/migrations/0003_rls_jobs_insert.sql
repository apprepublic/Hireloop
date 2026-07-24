-- Allow anon inserts for seeding/ingestion (jobs are public data)
drop policy if exists "Anyone can insert jobs" on public.jobs;
create policy "Anyone can insert jobs"
  on public.jobs for insert
  with check (true);
