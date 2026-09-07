-- Soft-delete for candidates: "removing" a candidate profile from the UI
-- must not destroy the underlying record (audit trail, accidental-delete
-- recovery). Every read path (list/get/exists/update) filters
-- `deleted_at is null`; the existing DELETE endpoint now sets this column
-- instead of issuing a real DELETE.

alter table candidates add column deleted_at timestamptz;

-- Company-scoped list/detail queries always filter on both columns together,
-- so it's worth indexing; partial index keeps it small since most rows are
-- never deleted.
create index idx_candidates_company_id_active on candidates(company_id) where deleted_at is null;
