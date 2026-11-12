import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase, readSupabaseFile } from "@/test/pglite-db";

const TYPE_A = "00000000-0000-0000-0000-00000000000a";
const ROOM_1 = "00000000-0000-0000-0000-000000000101";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase([
    `insert into units (id, name, slug, type, base_price_per_night) values
       ('${TYPE_A}', 'Type A', 'type-a', '1bed_standard', 100);
     insert into rooms (id, unit_id, number, is_active) values ('${ROOM_1}', '${TYPE_A}', 1, true);`,
  ]);
}, 60_000);

beforeEach(async () => {
  await db.exec("delete from room_access_codes; delete from bookings;");
});

describe("portal migration", { timeout: 30_000 }, () => {
  it("runs twice", async () => {
    await expect(db.exec(readSupabaseFile("migration-portal-v2.sql"))).resolves.toBeDefined();
  });

  it("stores a door code per room and reads it back", async () => {
    await db.query("insert into room_access_codes (room_id, access_code) values ($1, $2)", [ROOM_1, "4821#"]);
    const { rows } = await db.query<{ access_code: string }>("select access_code from room_access_codes where room_id = $1", [ROOM_1]);
    expect(rows[0].access_code).toBe("4821#");
  });

  it("refuses a code over 40 characters or empty", async () => {
    await expect(db.query("insert into room_access_codes (room_id, access_code) values ($1, $2)", [ROOM_1, "x".repeat(41)])).rejects.toThrow();
    await expect(db.query("insert into room_access_codes (room_id, access_code) values ($1, $2)", [ROOM_1, ""])).rejects.toThrow();
  });

  it("deletes the code with the room", async () => {
    const roomId = "00000000-0000-0000-0000-000000000199";
    await db.query("insert into rooms (id, unit_id, number, is_active) values ($1, $2, 99, true)", [roomId, TYPE_A]);
    await db.query("insert into room_access_codes (room_id, access_code) values ($1, '1234')", [roomId]);
    await db.query("delete from rooms where id = $1", [roomId]);
    const { rows } = await db.query("select 1 from room_access_codes where room_id = $1", [roomId]);
    expect(rows).toHaveLength(0);
  });

  it("accepts breakfast and airport transfer service requests", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into bookings (booking_code, unit_id, room_id, guest_name, guest_email, check_in, check_out, total_amount)
       values ('PORTAL-1', $1, $2, 'G', 'g@example.com', '2030-01-01', '2030-01-04', 100) returning id`,
      [TYPE_A, ROOM_1]
    );
    for (const type of ["airport_transfer", "breakfast"]) {
      await db.query("insert into service_requests (booking_id, type) values ($1, $2)", [rows[0].id, type]);
    }
    const count = await db.query<{ n: number }>("select count(*)::int as n from service_requests where booking_id = $1", [rows[0].id]);
    expect(count.rows[0].n).toBe(2);
  });
});
