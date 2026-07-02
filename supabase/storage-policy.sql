-- StudyTrainer Supabase Storage policy
--
-- Mirrors firestore.rules: StudyTrainer is an intentionally open, shared
-- study workspace with no authentication. Uploaded files must be readable
-- and writable by anyone so they're visible across all users, the same way
-- notes/quizzes/flashcards already are via the open Firestore rules.
--
-- Run this once in Supabase → SQL Editor for the project backing
-- VITE_SUPABASE_URL. Without it, uploads fail with a "row-level security"
-- / "Unauthorized" error (see src/lib/cloudDb.ts uploadFileToStorage) and
-- files never leave the uploading browser.
--
-- 1) Create the bucket first (Supabase → Storage → New bucket):
--      name: studytrainer
--      public: true
--    (or via SQL below, if it doesn't already exist)

insert into storage.buckets (id, name, public)
values ('studytrainer', 'studytrainer', true)
on conflict (id) do update set public = true;

-- 2) Allow anyone to read, upload, update, and delete objects in this
--    bucket — matching firestore.rules' "allow read, write: if true".
--    Storage RLS is enabled by default on storage.objects; these policies
--    open it back up scoped to just the studytrainer bucket.

drop policy if exists "studytrainer public read" on storage.objects;
create policy "studytrainer public read"
  on storage.objects for select
  using (bucket_id = 'studytrainer');

drop policy if exists "studytrainer public insert" on storage.objects;
create policy "studytrainer public insert"
  on storage.objects for insert
  with check (bucket_id = 'studytrainer');

drop policy if exists "studytrainer public update" on storage.objects;
create policy "studytrainer public update"
  on storage.objects for update
  using (bucket_id = 'studytrainer');

drop policy if exists "studytrainer public delete" on storage.objects;
create policy "studytrainer public delete"
  on storage.objects for delete
  using (bucket_id = 'studytrainer');
