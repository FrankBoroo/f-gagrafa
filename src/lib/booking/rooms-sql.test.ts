import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase, readSupabaseFile } from "@/test/pglite-db";

const TYPE_A = "00000000-0000-0000-0000-00000000000a";
const TYPE_B = "00000000-0000-0000-0000-00000000000b";
const room = (n: number) => `00000000-0000-0000-0000-00000000010${n}`;

let db: PGlite;
let bookingCount = 0;

// Inserts a live, paid booking on a room; `extra` overrides any column.
async function book(roomNumber: number | null, checkIn: string, checkOut: string, extra: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    booking_code: `TEST-${++bookingCount}`,
    unit_id: roomNumber === 4 ? TYPE_B : TYPE_A,
    room_id: roomNumber === null ? null : room(roomNumber),
    guest_name: "Test Guest",
    guest_email: "guest@example.com",
    check_in: checkIn,
    check_out: checkOut,
    total_amount: 100,
    status: "confirmed",
    payment_status: "paid",
    ...extra,
  };
  const columns = Object.keys(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await db.query<{ id: string }>(
    `insert into bookings (${columns.join(", ")}) values (${placeholders}) returning id`,
    Object.values(row)
  );
  return rows[0].id;
}

async function freeRooms(unitId: string, checkIn: string, checkOut: string, exclude: string | null = null) {
  const { rows } = await db.query<{ number: number }>(
    "select number from free_rooms_for_type($1, $2, $3, $4)",
    [unitId, checkIn, checkOut, exclude]
  );
  return rows.map((r) => r.number);
}

beforeAll(async () => {
  db = await createTestDatabase([
    `insert into units (id, name, slug, type, base_price_per_night) values
       ('${TYPE_A}', 'Type A', 'type-a', '1bed_standard', 100),
       ('${TYPE_B}', 'Type B', 'type-b', 'studio', 100);
     insert into rooms (id, unit_id, number, is_active) values
       ('${room(2)}', '${TYPE_A}', 2, true),
       ('${room(1)}', '${TYPE_A}', 1, true),
       ('${room(3)}', '${TYPE_A}', 3, false),
       ('${room(4)}', '${TYPE_B}', 4, true);`,
  ]);
}, 60_000);

beforeEach(async () => {
  await db.exec("delete from bookings; delete from blocked_dates;");
});

describe("rooms migration", { timeout: 30_000 }, () => {
  it("runs twice without error (idempotent)", async () => {
    await expect(db.exec(readSupabaseFile("migration-rooms.sql"))).resolves.toBeDefined();
  });

  it("lets two bookings of one type overlap on different rooms", async () => {
    await book(1, "2026-12-01", "2026-12-05");
    await expect(book(2, "2026-12-01", "2026-12-05")).resolves.toBeTruthy();
  });

  it("rejects two live bookings on one room for overlapping nights with 23P01", async () => {
    await book(1, "2026-12-01", "2026-12-05");
    await expect(book(1, "2026-12-04", "2026-12-06")).rejects.toMatchObject({ code: "23P01" });
  });

  it("allows back-to-back stays in one room", async () => {
    await book(1, "2026-12-01", "2026-12-03");
    await expect(book(1, "2026-12-03", "2026-12-05")).resolves.toBeTruthy();
  });

  it("ignores cancelled and no_show bookings in the overlap guard", async () => {
    await book(1, "2026-12-01", "2026-12-05", { status: "cancelled" });
    await book(1, "2026-12-01", "2026-12-05", { status: "no_show" });
    await expect(book(1, "2026-12-01", "2026-12-05")).resolves.toBeTruthy();
  });

  it("refuses a new live booking without a room", async () => {
    await expect(book(null, "2026-12-01", "2026-12-05")).rejects.toMatchObject({ code: "23514" });
  });
});

describe("free_rooms_for_type", { timeout: 30_000 }, () => {
  it("lists free active rooms in number order", async () => {
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([1, 2]);
  });

  it("drops a room with an overlapping live booking", async () => {
    await book(1, "2026-12-03", "2026-12-07");
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([2]);
  });

  it("keeps a room whose stay ends the day this one starts", async () => {
    await book(1, "2026-11-28", "2026-12-01");
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([1, 2]);
  });

  it("ignores unpaid pending holds older than 30 minutes", async () => {
    await book(1, "2026-12-01", "2026-12-05", {
      status: "pending",
      payment_status: "unpaid",
      created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
    });
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([1, 2]);
  });

  it("counts a fresh unpaid hold as taken", async () => {
    await book(1, "2026-12-01", "2026-12-05", { status: "pending", payment_status: "unpaid" });
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([2]);
  });

  it("drops a room blocked by its own blocked_dates row", async () => {
    await db.query(
      "insert into blocked_dates (unit_id, room_id, start_date, end_date) values ($1, $2, '2026-12-02', '2026-12-03')",
      [TYPE_A, room(1)]
    );
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([2]);
  });

  it("drops every room of the type for a block with null room_id", async () => {
    await db.query(
      "insert into blocked_dates (unit_id, start_date, end_date) values ($1, '2026-12-02', '2026-12-03')",
      [TYPE_A]
    );
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-05")).toEqual([]);
    expect(await freeRooms(TYPE_B, "2026-12-01", "2026-12-05")).toEqual([4]);
  });

  it("excludes the given booking, so a booking does not clash with itself", async () => {
    const id = await book(1, "2026-12-01", "2026-12-05");
    expect(await freeRooms(TYPE_A, "2026-12-01", "2026-12-06", id)).toEqual([1, 2]);
  });
});
