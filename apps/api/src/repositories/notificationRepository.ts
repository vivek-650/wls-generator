import { Pool, PoolClient } from "pg";
import { Notification } from "@wlr/shared-types";
import { pool } from "../db/pool";
import { AuthenticatedUser } from "../services/candidateService";

export interface NewNotificationInput {
  companyId: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * `companyId: null` is a platform-level notification (SUPER_ADMIN feed);
 * otherwise it's scoped to that company and visible to every user in it.
 * Accepts either the caller's already-open transaction `client` (fired
 * right after the event's own commit-worthy insert, same transaction, so a
 * rolled-back action never leaves an orphaned notice) or the plain `pool`
 * for the one emit site that isn't already inside a transaction.
 */
export async function insertNotification(client: Pool | PoolClient, data: NewNotificationInput): Promise<void> {
  await client.query(
    `insert into notifications (company_id, type, title, body, link)
     values ($1, $2, $3, $4, $5)`,
    [data.companyId, data.type, data.title, data.body ?? null, data.link ?? null]
  );
}

/** `company_id = user's company` for company users; `company_id is null` (platform feed) for SUPER_ADMIN. */
function scopeClause(user: AuthenticatedUser): { sql: string; params: unknown[] } {
  return user.role === "SUPER_ADMIN"
    ? { sql: "n.company_id is null", params: [] }
    : { sql: "n.company_id = $1", params: [user.companyId] };
}

export async function listForUser(user: AuthenticatedUser, limit = 20): Promise<Notification[]> {
  const scope = scopeClause(user);
  const userIdParamIndex = scope.params.length + 1;
  const limitParamIndex = scope.params.length + 2;

  const result = await pool.query<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: Date;
    is_read: boolean;
  }>(
    `select n.id, n.type, n.title, n.body, n.link, n.created_at,
            (nr.notification_id is not null) as is_read
       from notifications n
       left join notification_reads nr
         on nr.notification_id = n.id and nr.user_id = $${userIdParamIndex}
      where ${scope.sql}
      order by n.created_at desc
      limit $${limitParamIndex}`,
    [...scope.params, user.id, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.created_at.toISOString(),
    isRead: row.is_read,
  }));
}

export async function countUnread(user: AuthenticatedUser): Promise<number> {
  const scope = scopeClause(user);
  const userIdParamIndex = scope.params.length + 1;

  const result = await pool.query<{ count: string }>(
    `select count(*) as count
       from notifications n
       left join notification_reads nr
         on nr.notification_id = n.id and nr.user_id = $${userIdParamIndex}
      where ${scope.sql} and nr.notification_id is null`,
    [...scope.params, user.id]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markRead(user: AuthenticatedUser, notificationId: string): Promise<void> {
  await pool.query(
    `insert into notification_reads (notification_id, user_id)
     values ($1, $2)
     on conflict (notification_id, user_id) do nothing`,
    [notificationId, user.id]
  );
}

export async function markAllRead(user: AuthenticatedUser): Promise<void> {
  const scope = scopeClause(user);
  const userIdParamIndex = scope.params.length + 1;

  await pool.query(
    `insert into notification_reads (notification_id, user_id)
     select n.id, $${userIdParamIndex}
       from notifications n
       left join notification_reads nr
         on nr.notification_id = n.id and nr.user_id = $${userIdParamIndex}
      where ${scope.sql} and nr.notification_id is null
     on conflict (notification_id, user_id) do nothing`,
    [...scope.params, user.id]
  );
}
