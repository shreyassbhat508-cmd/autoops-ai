-- Creates a private storage bucket for receipt uploads and locks access
-- to the owning business, mirroring the RLS pattern used on the tables.
-- Files are stored under the path `${business_id}/${filename}`, and the
-- policies below check that prefix against businesses owned by auth.uid().
-- Safe to re-run: bucket insert is ON CONFLICT DO NOTHING, and every
-- policy is dropped before being recreated.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "Owners can upload their own receipts" on storage.objects;
create policy "Owners can upload their own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can view their own receipts" on storage.objects;
create policy "Owners can view their own receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can delete their own receipts" on storage.objects;
create policy "Owners can delete their own receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );
