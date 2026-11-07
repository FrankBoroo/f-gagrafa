import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase, readSupabaseFile } from "@/test/pglite-db";

const TYPE_A = "00000000-0000-0000-0000-00000000000a";
const TYPE_B = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function special(unitId: string, start: string, end: string, price: number | null = 250, minNights: number | null = null) {
  await db.query(
    "insert into special_prices (unit_id, start_date, end_date, nightly_price, min_nights) values ($1, $2, $3, $4, $5)",
    [unitId, start, end, price, minNights]
  );
}

beforeAll(async () => {
  db = await createTestDatabase([
    `insert into units (id, name, slug, type, base_price_per_night) values
       ('${TYPE_A}', 'Type A', 'type-a', '1bed_standard', 170),
       ('${TYPE_B}', 'Type B', 'type-b', 'studio', 100);`,
  ]);
}, 60_000);

beforeEach(async () => {
  await db.exec("delete from special_prices; delete from guest_notes;");
});

describe("admin migration", { timeout: 30_000 }, () => {
  it("the admin migration runs twice", async () => {
    await expect(db.exec(readSupabaseFile("migration-admin.sql"))).resolves.toBeDefined();
  });

  it("adds the room cleaning time and the booking attention flag", async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where (table_name = 'rooms' and column_name = 'last_cleaned_at')
          or (table_name = 'bookings' and column_name = 'attention_cleared_at')`
    );
    expect(rows).toHaveLength(2);
  });

  it("special prices may not overlap on the same type", async () => {
    await special(TYPE_A, "2026-12-20", "2026-12-27");
    await expect(special(TYPE_A, "2026-12-26", "2026-12-30")).rejects.toMatchObject({ code: "23P01" });
    await expect(special(TYPE_B, "2026-12-26", "2026-12-30")).resolves.toBeUndefined();
  });

  it("touching special-price ranges are allowed", async () => {
    await special(TYPE_A, "2026-12-20", "2026-12-27");
    await expect(special(TYPE_A, "2026-12-27", "2027-01-02")).resolves.toBeUndefined();
  });

  it("a special price needs a price or a minimum stay", async () => {
    await expect(special(TYPE_A, "2026-12-20", "2026-12-27", null, null)).rejects.toMatchObject({ code: "23514" });
    await expect(special(TYPE_A, "2026-12-20", "2026-12-20")).rejects.toMatchObject({ code: "23514" });
    await expect(special(TYPE_A, "2026-12-20", "2026-12-27", 0)).rejects.toMatchObject({ code: "23514" });
    await expect(special(TYPE_A, "2026-12-20", "2026-12-27", null, 3)).resolves.toBeUndefined();
  });

  it("guest notes are keyed by lower-case email", async () => {
    await expect(db.query("insert into guest_notes (email, notes) values ('Ama@Example.com', 'x')")).rejects.toMatchObject({
      code: "23514",
    });
    await expect(db.query("insert into guest_notes (email, notes) values ('ama@example.com', 'x')")).resolves.toBeDefined();
  });
});
