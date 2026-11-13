import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase, readSupabaseFile } from "@/test/pglite-db";

const TYPE_A = "00000000-0000-0000-0000-00000000000a";
const ROOM_1 = "00000000-0000-0000-0000-000000000101";
const ROOM_2 = "00000000-0000-0000-0000-000000000102";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase([
    `insert into units (id, name, slug, type, base_price_per_night) values
       ('${TYPE_A}', 'Type A', 'type-a', '1bed_standard', 100);
     insert into rooms (id, unit_id, number, is_active) values
       ('${ROOM_1}', '${TYPE_A}', 1, true),
       ('${ROOM_2}', '${TYPE_A}', 2, true);`,
  ]);
}, 60_000);

beforeEach(async () => {
  await db.exec("delete from external_reservations;");
});

async function addReservation(roomId: string, uid: string, checkIn: string, checkOut: string, removed = false) {
  await db.query(
    `insert into external_reservations (room_id, uid, check_in, check_out, removed_at)
     values ($1, $2, $3, $4, ${removed ? "now()" : "null"})`,
    [roomId, uid, checkIn, checkOut]
  );
}

async function available(roomId: string, checkIn: string, checkOut: string) {
  const { rows } = await db.query<{ ok: boolean }>("select is_room_available($1, $2, $3) as ok", [roomId, checkIn, checkOut]);
  return rows[0].ok;
}

describe("airbnb migration", { timeout: 30_000 }, () => {
  it("runs twice", async () => {
    await expect(db.exec(readSupabaseFile("migration-airbnb.sql"))).resolves.toBeDefined();
  });

  it("gives every room its own 64-character export token", async () => {
    const { rows } = await db.query<{ ical_export_token: string }>("select ical_export_token from rooms");
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.ical_export_token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(rows.map((r) => r.ical_export_token)).size).toBe(2);
  });

  it("refuses an import URL over 500 characters", async () => {
    await expect(db.query("update rooms set airbnb_ical_url = $1 where id = $2", ["x".repeat(501), ROOM_1])).rejects.toThrow();
  });

  it("treats a live external reservation as unavailable and skips the room", async () => {
    await addReservation(ROOM_1, "uid-1", "2026-12-10", "2026-12-13");
    expect(await available(ROOM_1, "2026-12-11", "2026-12-12")).toBe(false);
    const { rows } = await db.query<{ number: number }>("select number from free_rooms_for_type($1, '2026-12-11', '2026-12-12')", [TYPE_A]);
    expect(rows.map((r) => r.number)).toEqual([2]);
  });

  it("ignores a removed external reservation", async () => {
    await addReservation(ROOM_1, "uid-1", "2026-12-10", "2026-12-13", true);
    expect(await available(ROOM_1, "2026-12-11", "2026-12-12")).toBe(true);
  });

  it("allows back-to-back stays", async () => {
    await addReservation(ROOM_1, "uid-1", "2026-12-10", "2026-12-13");
    expect(await available(ROOM_1, "2026-12-13", "2026-12-15")).toBe(true);
    expect(await available(ROOM_1, "2026-12-08", "2026-12-10")).toBe(true);
  });

  it("does not let another room's reservation block this one", async () => {
    await addReservation(ROOM_2, "uid-1", "2026-12-10", "2026-12-13");
    expect(await available(ROOM_1, "2026-12-11", "2026-12-12")).toBe(true);
  });

  it("refuses a second row with the same room and uid", async () => {
    await addReservation(ROOM_1, "uid-1", "2026-12-10", "2026-12-13");
    await expect(addReservation(ROOM_1, "uid-1", "2026-12-20", "2026-12-22")).rejects.toThrow();
  });

  it("refuses check-out on or before check-in", async () => {
    await expect(addReservation(ROOM_1, "uid-1", "2026-12-10", "2026-12-10")).rejects.toThrow();
  });

  it("deletes reservations with the room", async () => {
    const roomId = "00000000-0000-0000-0000-000000000199";
    await db.query("insert into rooms (id, unit_id, number, is_active) values ($1, $2, 99, true)", [roomId, TYPE_A]);
    await addReservation(roomId, "uid-1", "2026-12-10", "2026-12-13");
    await db.query("delete from rooms where id = $1", [roomId]);
    const { rows } = await db.query("select 1 from external_reservations where room_id = $1", [roomId]);
    expect(rows).toHaveLength(0);
  });
});
