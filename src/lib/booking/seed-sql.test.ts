import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase, readSupabaseFile } from "@/test/pglite-db";

const count = async (db: PGlite, table: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase([
    `insert into units (id, name, slug, type, base_price_per_night)
       values ('00000000-0000-0000-0000-0000000000aa', 'Old', 'old', 'studio', 1);
     insert into rooms (id, unit_id, number)
       values ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000aa', 99);
     insert into bookings (booking_code, unit_id, room_id, guest_name, guest_email, check_in, check_out, total_amount)
       values ('OLD-1', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb',
               'Old Guest', 'old@example.com', '2026-12-01', '2026-12-02', 1);
     insert into payments (booking_id, amount, method, status)
       select id, 1, 'cash', 'success' from bookings;
     insert into gallery_items (image_url, category) values ('https://example.com/a.jpg', 'property');
     insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000cc', 'admin@example.com');
     insert into profiles (id, role) values ('00000000-0000-0000-0000-0000000000cc', 'admin')
       on conflict (id) do nothing;`,
  ]);
  await db.exec(readSupabaseFile("reset-and-seed.sql"));
}, 60_000);

describe("reset-and-seed", { timeout: 30_000 }, () => {
  it("seeds 13 rooms with the owner's room numbers", async () => {
    const { rows } = await db.query<{ number: number; slug: string }>(
      "select r.number, u.slug from rooms r join units u on u.id = r.unit_id order by r.number"
    );
    expect(rows.map((r) => [r.number, r.slug])).toEqual([
      [1, "studio"], [2, "one-bed-executive"], [3, "one-bed-standard"], [4, "two-bed-executive"],
      [5, "one-bed-standard"], [6, "two-bed-executive"], [7, "one-bed-standard"], [8, "one-bed-executive"],
      [9, "one-bed-executive"], [10, "one-bed-standard"], [11, "one-bed-executive"], [12, "one-bed-executive"],
      [13, "penthouse"],
    ]);
  });

  it("seeds the old-site prices", async () => {
    const { rows } = await db.query<{ slug: string; nightly: number; monthly: number | null; max_guests: number }>(
      `select slug, base_price_per_night::float as nightly, monthly_price::float as monthly, max_guests
       from units order by sort_order`
    );
    expect(rows.map((u) => [u.slug, u.nightly, u.monthly, u.max_guests])).toEqual([
      ["studio", 100, null, 2],
      ["one-bed-standard", 170, 1500, 2],
      ["one-bed-executive", 200, 2000, 2],
      ["two-bed-executive", 250, 2500, 2],
      ["penthouse", 300, 2500, 2],
    ]);
  });

  it("empties bookings and payments", async () => {
    expect(await count(db, "bookings")).toBe(0);
    expect(await count(db, "payments")).toBe(0);
  });

  it("keeps profiles, property_settings and gallery_items", async () => {
    expect(await count(db, "profiles")).toBeGreaterThan(0);
    expect(await count(db, "property_settings")).toBe(1);
    expect(await count(db, "gallery_items")).toBe(1);
  });

  it("sets property_settings to USD pricing with deposit_percent 50", async () => {
    const { rows } = await db.query<{ price_currency: string; deposit_percent: number }>(
      "select price_currency, deposit_percent from property_settings"
    );
    expect(rows).toEqual([{ price_currency: "USD", deposit_percent: 50 }]);
  });

  it("can be run twice", async () => {
    await db.exec(readSupabaseFile("reset-and-seed.sql"));
    expect(await count(db, "rooms")).toBe(13);
    expect(await count(db, "units")).toBe(5);
  });
});
