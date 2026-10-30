import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = process.cwd();

export function readSupabaseFile(file: string): string {
  // gen_random_uuid() is built into Postgres 13+, and PGlite ships no pgcrypto.
  return readFileSync(join(root, "supabase", file), "utf8").replace(
    /create extension if not exists "pgcrypto";/i,
    ""
  );
}

// A throwaway database built from the same SQL files, in the same order, as production.
export async function createTestDatabase(extraSql: string[] = []): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(root, "scripts", "supabase-stub.sql"), "utf8"));
  const files: string[] = JSON.parse(readFileSync(join(root, "supabase", "sql-files.json"), "utf8"));
  for (const file of files) await db.exec(readSupabaseFile(file));
  for (const sql of extraSql) await db.exec(sql);
  return db;
}
