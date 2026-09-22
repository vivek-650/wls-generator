-- Notification feed: `company_id null` means a platform-level notification
-- (shown to SUPER_ADMIN accounts only); otherwise it's scoped to one
-- company, visible to every user in that company. Read state is per-user
-- via a junction table rather than a flag on `notifications`, so the same
-- notification can be read by one teammate and still show unread for
-- another — matches this schema's existing preference for junction tables
-- over denormalized per-row flags.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now()
);

create index idx_notifications_company_id on notifications(company_id);
create index idx_notifications_created_at on notifications(created_at desc);

create table notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
