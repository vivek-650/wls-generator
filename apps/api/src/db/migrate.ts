import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { createPool } from "./pool";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>("select name from schema_migrations");
  return new Set(result.rows.map((row: { name: string }) => row.name));
}

export async function runMigrations(): Promise<void> {
  const pool = createPool();

  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedMigrations(pool);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skipping already-applied ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`[migrate] applying ${file}`);

      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      } finally {
        client.release();
      }
    }

    console.log("[migrate] up to date");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
