import { pool } from "../db/pool";

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export async function createRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<RefreshTokenRow> {
  const result = await pool.query<RefreshTokenRow>(
    `insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3) returning *`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

export async function findActiveRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const result = await pool.query<RefreshTokenRow>(
    `select * from refresh_tokens
     where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await pool.query(`update refresh_tokens set revoked_at = now() where id = $1`, [id]);
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
  await pool.query(
    `update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null`,
    [tokenHash]
  );
}
