-- Storage policy setup for StoryShort
-- Run this in Supabase SQL Editor if bucket is newly created

-- Ensure renders-images bucket exists and is public
insert into storage.buckets (id, name, public) 
values ('renders-images','renders-images', true)
on conflict (id) do update set public = true;

-- Create public read policy for renders-images bucket
create policy "Public read" on storage.objects
for select using ( bucket_id = 'renders-images' );

-- Optional: Create insert policy for authenticated users (if needed)
-- create policy "Authenticated users can upload" on storage.objects
-- for insert with check ( bucket_id = 'renders-images' AND auth.role() = 'authenticated' );

-- Optional: Create update policy for authenticated users (if needed)
-- create policy "Authenticated users can update" on storage.objects
-- for update using ( bucket_id = 'renders-images' AND auth.role() = 'authenticated' );

-- Optional: Create delete policy for authenticated users (if needed)
-- create policy "Authenticated users can delete" on storage.objects
-- for delete using ( bucket_id = 'renders-images' AND auth.role() = 'authenticated' );

-- Verify the setup
select 
  b.name as bucket_name,
  b.public as is_public,
  count(p.policy_name) as policy_count
from storage.buckets b
left join storage.policies p on b.id = p.bucket_id
where b.name = 'renders-images'
group by b.name, b.public; 