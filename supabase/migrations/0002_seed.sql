-- Seed job sources
insert into public.job_sources (id, display_name, is_compliant) values
  ('adzuna', 'Adzuna', true),
  ('jooble', 'Jooble', true),
  ('linkedin_unofficial', 'LinkedIn', false)
on conflict (id) do nothing;

-- Seed sample jobs
insert into public.jobs (source_id, external_id, title, company, location, is_remote, description, salary_min, salary_max, currency, job_type, seniority, apply_url, ats_platform, auto_apply_eligible, posted_at, dedupe_hash, match_score) values
  ('adzuna', 'adz-001', 'Senior Software Engineer', 'Flutterwave', 'Lagos, Nigeria', false, 'We are looking for a Senior Software Engineer to join our payments team. You will build and maintain scalable payment infrastructure processing millions of transactions daily.', 80000, 120000, 'USD', 'full_time', 'Senior', 'https://flutterwave.com/careers/senior-software-engineer', 'greenhouse', true, now() - interval '2 days', 'hash-001', 92),
  ('jooble', 'joo-001', 'Frontend Developer (React)', 'Paystack', 'Lagos, Nigeria', true, 'Join our frontend team to build beautiful, performant interfaces for Africa''s leading payment platform.', 60000, 90000, 'USD', 'full_time', 'Mid', 'https://paystack.com/careers/frontend-developer', 'lever', true, now() - interval '5 days', 'hash-002', 85),
  ('linkedin_unofficial', 'li-001', 'Product Manager', 'Andela', 'Remote', true, 'Andela is seeking a Product Manager to drive our talent marketplace platform.', 70000, 110000, 'USD', 'full_time', 'Senior', 'https://www.linkedin.com/jobs/view/product-manager-andela', null, false, now() - interval '1 day', 'hash-003', 78),
  ('adzuna', 'adz-002', 'DevOps Engineer', 'Interswitch', 'Lagos, Nigeria', false, 'Manage and improve our cloud infrastructure on AWS. Automate deployments, manage Kubernetes clusters.', 75000, 100000, 'USD', 'full_time', 'Senior', 'https://interswitch.com/careers/devops-engineer', 'workable', true, now() - interval '3 days', 'hash-004', 70),
  ('jooble', 'joo-002', 'Data Scientist', 'Kuda Bank', 'Lagos, Nigeria', true, 'Help us build the future of digital banking in Africa. Analyze user behavior and build recommendation systems.', 65000, 95000, 'USD', 'full_time', 'Mid', 'https://kuda.com/careers/data-scientist', 'greenhouse', true, now() - interval '7 days', 'hash-005', 65),
  ('linkedin_unofficial', 'li-002', 'UI/UX Designer', 'Chipper Cash', 'Accra, Ghana', true, 'Design intuitive, delightful experiences for millions of users across Africa.', 55000, 85000, 'USD', 'full_time', 'Mid', 'https://www.linkedin.com/jobs/view/ui-ux-designer-chipper-cash', null, false, now() - interval '4 days', 'hash-006', 88),
  ('adzuna', 'adz-003', 'Backend Engineer (Node.js)', 'PiggyVest', 'Lagos, Nigeria', true, 'Build and maintain backend services powering Nigeria''s largest savings and investment platform.', 50000, 80000, 'USD', 'full_time', 'Mid', 'https://piggyvest.com/careers/backend-engineer', 'lever', true, now() - interval '6 days', 'hash-007', 90),
  ('jooble', 'joo-003', 'Mobile Developer (Flutter)', 'Carbon', 'Lagos, Nigeria', false, 'Develop and maintain our cross-platform mobile application used by millions.', 45000, 75000, 'USD', 'full_time', 'Mid', 'https://carbon.ng/careers/mobile-developer', 'workable', true, now() - interval '8 days', 'hash-008', 82),
  ('linkedin_unofficial', 'li-003', 'Technical Writer', 'Twilio', 'Remote', true, 'Create clear, comprehensive documentation for Twilio''s developer products.', 60000, 90000, 'USD', 'full_time', 'Senior', 'https://www.linkedin.com/jobs/view/technical-writer-twilio', null, false, now() - interval '10 days', 'hash-009', 72),
  ('adzuna', 'adz-004', 'Customer Success Manager', 'Paystack', 'Lagos, Nigeria', false, 'Help merchants succeed on Paystack. Onboard new businesses and provide ongoing support.', 40000, 60000, 'USD', 'full_time', 'Mid', 'https://paystack.com/careers/customer-success-manager', 'lever', false, now() - interval '12 days', 'hash-010', 60)
on conflict (source_id, external_id) do nothing;
