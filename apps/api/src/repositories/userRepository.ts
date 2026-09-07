import { PoolClient } from "pg";
import { AuthUser, UserRole } from "@wlr/shared-types";
import { pool } from "../db/pool";
import { CompanyScope } from "./withCompanyScope";

export interface UserRow {
  id: string;
  company_id: string | null;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: Date;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    companyId: row.company_id,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>("select * from users where email = $1", [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>("select * from users where id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function createUser(
  client: PoolClient,
  data: { companyId: string | null; email: string; passwordHash: string; name: string; role: UserRole }
): Promise<UserRow> {
  const result = await client.query<UserRow>(
    `insert into users (company_id, email, password_hash, name, role)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [data.companyId, data.email, data.passwordHash, data.name, data.role]
  );
  return result.rows[0];
}

export async function listCompanyUsers(scope: CompanyScope): Promise<AuthUser[]> {
  const result = await pool.query<UserRow>(
    `select * from users where company_id = $1 order by created_at asc`,
    [scope.companyId]
  );
  return result.rows.map(toAuthUser);
}

export async function findCompanyUserById(scope: CompanyScope, userId: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `select * from users where id = $1 and company_id = $2`,
    [userId, scope.companyId]
  );
  return result.rows[0] ?? null;
}

export async function deleteCompanyUser(scope: CompanyScope, userId: string): Promise<boolean> {
  const result = await pool.query(
    `delete from users where id = $1 and company_id = $2`,
    [userId, scope.companyId]
  );
  return (result.rowCount ?? 0) > 0;
}

export { toAuthUser };
