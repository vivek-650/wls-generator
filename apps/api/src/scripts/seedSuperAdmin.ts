/**
 * One-off bootstrap for the platform's SUPER_ADMIN account. There is no
 * public route that can create a SUPER_ADMIN (company_id must be NULL,
 * which the register endpoint never does) — this script is the only way.
 *
 * Usage: npm run seed:super-admin
 * Reads SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from the environment and
 * upserts that user (creates it if missing, otherwise leaves it alone).
 */
import bcrypt from "bcrypt";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { findUserByEmail } from "../repositories/userRepository";

async function seedSuperAdmin(): Promise<void> {
  if (!env.superAdminEmail || !env.superAdminPassword) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to run this script");
  }

  const existing = await findUserByEmail(env.superAdminEmail);
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      throw new Error(
        `A user with email ${env.superAdminEmail} already exists with role ${existing.role}, not SUPER_ADMIN`
      );
    }
    console.log(`[seed] SUPER_ADMIN ${env.superAdminEmail} already exists — nothing to do`);
    return;
  }

  const passwordHash = await bcrypt.hash(env.superAdminPassword, 10);
  await pool.query(
    `insert into users (company_id, email, password_hash, name, role)
     values (null, $1, $2, $3, 'SUPER_ADMIN')`,
    [env.superAdminEmail, passwordHash, "Super Admin"]
  );
  console.log(`[seed] created SUPER_ADMIN ${env.superAdminEmail}`);
}

seedSuperAdmin()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
