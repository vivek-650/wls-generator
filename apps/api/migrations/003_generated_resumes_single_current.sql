-- Move generated_resumes from "one row per export" (each pointing at its own
-- Cloudinary file) to "one current row per candidate", upserted in place —
-- exporting a candidate again now overwrites the same Cloudinary asset
-- (same URL) instead of accumulating a new file + row every time.

alter table generated_resumes add column updated_at timestamptz not null default now();

-- Dedupe any existing multi-row history down to the most recent export per
-- candidate before the unique constraint below can be added. Tuple
-- comparison (created_at, id) gives a strict total order even if two rows
-- somehow share a created_at timestamp.
delete from generated_resumes gr
using generated_resumes newer
where gr.candidate_id = newer.candidate_id
  and (gr.created_at, gr.id) < (newer.created_at, newer.id);

alter table generated_resumes
  add constraint generated_resumes_candidate_id_key unique (candidate_id);
