// Generates src/types/database.ts from the SQL files in supabase/, in the format of
// `supabase gen types typescript`. Run with `npm run db:types` after changing a migration.
//
// It builds the schema in PGlite (Postgres in WebAssembly), so it needs no Docker, no
// Supabase login and no access to the live database. The trade-off: the types describe the
// SQL files, not production. A column added by hand in the Supabase dashboard won't appear
// until it is written into a migration (which is the rule anyway).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same order as "Database" in CLAUDE.md.
const SQL_FILES = [
  "schema.sql",
  "migration-booking-safety.sql",
  "migration-portal-and-ops.sql",
  "migration-tour-gallery.sql",
  "migration-deposits.sql",
  "migration-usd-pricing.sql",
  "migration-rate-limits.sql",
  "migration-rls-hardening.sql",
  "migration-admin-only-writes.sql",
];

// The pieces of Supabase that the SQL files lean on.
const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as 'select null::uuid';
`;

const db = new PGlite({ extensions: { btree_gist } });
await db.exec(SUPABASE_STUB);
for (const file of SQL_FILES) {
  // gen_random_uuid() is built into Postgres 13+, and PGlite ships no pgcrypto.
  const sql = readFileSync(join(root, "supabase", file), "utf8").replace(
    /create extension if not exists "pgcrypto";/i,
    ""
  );
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

const rows = async (sql) => (await db.query(sql)).rows;

const enums = await rows(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname`);
const enumNames = new Set(enums.map((e) => e.name));

const columns = await rows(`
  select c.relname as table_name, c.relkind as kind, a.attname as name, a.attnum as position,
         t.typname as type, t.typcategory as category, et.typname as element_type,
         a.attnotnull as not_null, a.atthasdef as has_default,
         a.attgenerated as generated, a.attidentity as identity
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attname`);

const foreignKeys = await rows(`
  select src.relname as table_name, con.conname as name,
         array(select a.attname from unnest(con.conkey) k join pg_attribute a
               on a.attrelid = con.conrelid and a.attnum = k order by a.attname) as columns,
         dst.relname as referenced_table,
         array(select a.attname from unnest(con.confkey) k join pg_attribute a
               on a.attrelid = con.confrelid and a.attnum = k order by a.attname) as referenced_columns,
         exists (
           select 1 from pg_index i
           where i.indrelid = con.conrelid and i.indisunique
             and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
               = (select array_agg(x order by x) from unnest(con.conkey) x)
         ) as one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class dst on dst.oid = con.confrelid
  join pg_namespace sn on sn.oid = src.relnamespace
  join pg_namespace dn on dn.oid = dst.relnamespace
  where con.contype = 'f' and sn.nspname = 'public' and dn.nspname = 'public'
  order by src.relname, con.conname`);

// Skips trigger functions and the ones that come with extensions (btree_gist).
const functions = await rows(`
  select p.proname as name, p.proargnames as arg_names, p.pronargs as arg_count,
         p.pronargdefaults as default_count, p.proretset as returns_set,
         array(select t.typname from unnest(p.proargtypes) with ordinality as x(oid, i)
               join pg_type t on t.oid = x.oid order by x.i) as arg_types,
         rt.typname as return_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname`);

await db.close();

const SCALARS = {
  bool: "boolean",
  int2: "number", int4: "number", int8: "number", float4: "number", float8: "number", numeric: "number",
  text: "string", varchar: "string", bpchar: "string", uuid: "string", citext: "string",
  date: "string", time: "string", timetz: "string", timestamp: "string", timestamptz: "string", interval: "string",
  json: "Json", jsonb: "Json",
  void: "undefined",
};

function tsType(type) {
  if (enumNames.has(type)) return `Database["public"]["Enums"]["${type}"]`;
  const scalar = SCALARS[type];
  if (!scalar) throw new Error(`No TypeScript mapping for Postgres type "${type}"; add it to SCALARS.`);
  return scalar;
}

function columnType(col) {
  return col.category === "A" ? `${tsType(col.element_type)}[]` : tsType(col.type);
}

const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));
const indent = (text, depth) => text.split("\n").map((line) => (line ? "  ".repeat(depth) + line : line)).join("\n");
const block = (lines) => (lines.length ? `{\n${lines.map((l) => indent(l, 1)).join("\n")}\n}` : "{\n  [_ in never]: never\n}");

function tableBlock(table, cols, isView) {
  const row = cols.map((c) => `${key(c.name)}: ${columnType(c)}${c.not_null ? "" : " | null"}`);
  const insert = cols.map((c) => {
    if (c.generated === "s" || c.identity === "a") return `${key(c.name)}?: never`;
    const optional = !c.not_null || c.has_default || c.identity === "d";
    return `${key(c.name)}${optional ? "?" : ""}: ${columnType(c)}${c.not_null ? "" : " | null"}`;
  });
  const update = cols.map((c) =>
    c.generated === "s" || c.identity === "a"
      ? `${key(c.name)}?: never`
      : `${key(c.name)}?: ${columnType(c)}${c.not_null ? "" : " | null"}`
  );
  const relationships = foreignKeys
    .filter((fk) => fk.table_name === table)
    .map((fk) =>
      [
        "{",
        `  foreignKeyName: ${JSON.stringify(fk.name)}`,
        `  columns: [${fk.columns.map((c) => JSON.stringify(c)).join(", ")}]`,
        `  isOneToOne: ${fk.one_to_one}`,
        `  referencedRelation: ${JSON.stringify(fk.referenced_table)}`,
        `  referencedColumns: [${fk.referenced_columns.map((c) => JSON.stringify(c)).join(", ")}]`,
        "},",
      ].join("\n")
    );
  const parts = [`Row: ${block(row)}`];
  if (!isView) parts.push(`Insert: ${block(insert)}`, `Update: ${block(update)}`);
  parts.push(`Relationships: ${relationships.length ? `[\n${relationships.map((r) => indent(r, 1)).join("\n")}\n]` : "[]"}`);
  return `${key(table)}: ${block(parts)}`;
}

const byTable = new Map();
for (const col of columns) {
  if (!byTable.has(col.table_name)) byTable.set(col.table_name, { kind: col.kind, cols: [] });
  byTable.get(col.table_name).cols.push(col);
}
const tables = [...byTable].filter(([, t]) => t.kind === "r" || t.kind === "p");
const views = [...byTable].filter(([, t]) => t.kind === "v" || t.kind === "m");

const functionLines = functions.map((fn) => {
  const names = fn.arg_names ?? [];
  const firstDefault = fn.arg_count - fn.default_count;
  const args = fn.arg_types.map((type, i) => `${key(names[i] ?? `arg${i}`)}${i >= firstDefault ? "?" : ""}: ${tsType(type)}`);
  const returns = tsType(fn.return_type) + (fn.returns_set ? "[]" : "");
  return `${key(fn.name)}: ${block([`Args: ${args.length ? block(args) : "never"}`, `Returns: ${returns}`])}`;
});

const enumLines = enums.map((e) => `${key(e.name)}: ${e.labels.map((l) => JSON.stringify(l)).join(" | ")}`);
const constantLines = enums.map((e) => `${key(e.name)}: [${e.labels.map((l) => JSON.stringify(l)).join(", ")}],`);

const publicSchema = block([
  `Tables: ${block(tables.map(([name, t]) => tableBlock(name, t.cols, false)))}`,
  `Views: ${block(views.map(([name, t]) => tableBlock(name, t.cols, true)))}`,
  `Functions: ${block(functionLines)}`,
  `Enums: ${block(enumLines)}`,
  "CompositeTypes: {\n  [_ in never]: never\n}",
]);

const output = `// Generated by scripts/gen-db-types.mjs from supabase/*.sql. Do not edit by hand:
// change the SQL, then run \`npm run db:types\`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Supabase hosts PostgREST 12+; this unlocks the matching query-builder types.
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: ${indent(publicSchema, 1).trimStart()}
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: ${indent(block(constantLines), 2).trimStart()},
  },
} as const
`;

const target = join(root, "src", "types", "database.ts");
writeFileSync(target, output);
console.log(`Wrote ${target}: ${tables.length} tables, ${functions.length} functions, ${enums.length} enums.`);
