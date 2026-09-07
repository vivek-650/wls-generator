import { Pool, PoolConfig } from "pg";
import { env } from "../config/env";

// Any non-loopback host (Supabase included, in dev or prod) requires TLS;
// Supabase's endpoint presents a certificate chain Node's default trust
// store won't validate against, so we don't require a bundled CA file here.
function sslConfigFor(databaseUrl: string): PoolConfig["ssl"] {
  const isLocalHost = /^(localhost|127\.0\.0\.1|::1)$/.test(new URL(databaseUrl).hostname);
  return isLocalHost ? undefined : { rejectUnauthorized: false };
}

export function createPool(connectionString: string = env.databaseUrl): Pool {
  return new Pool({ connectionString, ssl: sslConfigFor(connectionString) });
}

export const pool = createPool();

export async function closePool(): Promise<void> {
  await pool.end();
}
