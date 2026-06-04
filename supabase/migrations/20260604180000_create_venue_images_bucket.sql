-- Create the venue-images storage bucket (public reads, authenticated writes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-images',
  'venue-images',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload images into their own folder
create policy "Venue owners can upload images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'venue-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to replace (update) their own images
create policy "Venue owners can replace images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'venue-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own images
create policy "Venue owners can delete images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'venue-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access (bucket is public)
create policy "Anyone can view venue images"
on storage.objects for select
to public
using (bucket_id = 'venue-images');
