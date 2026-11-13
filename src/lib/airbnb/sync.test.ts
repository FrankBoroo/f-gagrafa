import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  room_id: string;
  uid: string;
  check_in: string;
  check_out: string;
  summary: string | null;
  guest_name: string | null;
  last_seen_at: string | null;
  removed_at: string | null;
}
interface RoomWrite {
  payload: Record<string, unknown>;
  id: unknown;
}

const mocks = vi.hoisted(() => ({
  db: {} as {
    rows: Row[];
    roomWrites: RoomWrite[];
    rooms: Record<string, unknown>[];
    roomFilters: string[];
    reservationWrites: number;
    removalFilters: Array<Record<string, unknown>>;
  },
  alert: vi.fn(),
}));

// Stand-in for the Supabase query builder: reads and writes `db.rows` / records room updates.
class FakeQuery {
  private op: "select" | "upsert" | "update" = "select";
  private payload: unknown = null;
  private filters: Record<string, unknown> = {};
  private inIds: string[] | null = null;
  constructor(private table: string) {}
  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters[column] = value;
    if (this.table === "rooms" && this.op === "select") mocks.db.roomFilters.push(`eq.${column}`);
    return this;
  }
  not() { return this; }
  lt(column: string, value: unknown) { this.filters[`lt.${column}`] = value; return this; }
  or(expr: string) { mocks.db.roomFilters.push(`or.${expr.split(".lt.")[0]}`); return this; }
  in(_column: string, ids: string[]) { this.inIds = ids; return this; }
  upsert(rows: unknown) { this.op = "upsert"; this.payload = rows; return this; }
  update(payload: Record<string, unknown>) { this.op = "update"; this.payload = payload; return this; }
  then<T>(resolve: (value: { data: unknown; error: { message: string } | null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
  private run(): { data: unknown; error: { message: string } | null } {
    const { db } = mocks;
    if (this.table === "rooms") {
      if (this.op === "select") return { data: db.rooms, error: null };
      db.roomWrites.push({ payload: this.payload as Record<string, unknown>, id: this.filters.id });
      return { data: null, error: null };
    }
    if (this.op === "select") {
      return { data: db.rows.filter((r: Row) => r.room_id === this.filters.room_id).map((r: Row) => ({ ...r })), error: null };
    }
    db.reservationWrites += 1;
    if (this.op === "upsert") {
      for (const p of this.payload as Record<string, unknown>[]) {
        const existing = db.rows.find((r: Row) => r.room_id === p.room_id && r.uid === p.uid);
        if (existing) Object.assign(existing, p);
        else db.rows.push({ id: `new-${db.rows.length}`, guest_name: null, summary: null, last_seen_at: null, removed_at: null, ...p } as unknown as Row);
      }
      return { data: null, error: null };
    }
    db.removalFilters.push({ ...this.filters, in: this.inIds });
    const seenBefore = this.filters["lt.last_seen_at"] as string | undefined;
    for (const r of db.rows) {
      if (!this.inIds?.includes(r.id)) continue;
      if (seenBefore !== undefined && !(r.last_seen_at !== null && r.last_seen_at < seenBefore)) continue;
      Object.assign(r, this.payload);
    }
    return { data: null, error: null };
  }
}

vi.mock("@/lib/notify/email", () => ({ sendAdminSystemAlert: mocks.alert }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { syncRoom, syncRooms } = await import("@/lib/airbnb/sync");
const { airbnbCalendarUrlProblem } = await import("@/lib/airbnb/url");

const URL_OK = "https://www.airbnb.com/calendar/ical/123.ics?s=abc";
const NOW = new Date("2026-11-13T10:00:00Z");
// last_seen_at is not null in the table; a row saved by an earlier run.
const SEEN_BEFORE = "2026-11-12T10:00:00.000Z";
const supabase = { from: (t: string) => new FakeQuery(t) } as never;

function room(overrides: Record<string, unknown> = {}) {
  return { id: "room-1", number: 4, airbnb_ical_url: URL_OK, airbnb_sync_error: null, ...overrides };
}
function ics(...events: Array<[string, string, string]>): string {
  const body = events.flatMap(([uid, s, e]: [string, string, string]) => [
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTART;VALUE=DATE:${s}`, `DTEND;VALUE=DATE:${e}`, "SUMMARY:Reserved", "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...body, "END:VCALENDAR"].join("\r\n");
}
function fetchOf(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}
function row(overrides: Partial<Row>): Row {
  return { id: "r1", room_id: "room-1", uid: "a", check_in: "2026-12-01", check_out: "2026-12-05", summary: "Reserved", guest_name: "Ama", last_seen_at: SEEN_BEFORE, removed_at: null, ...overrides };
}
function lastRoomWrite() {
  return mocks.db.roomWrites[mocks.db.roomWrites.length - 1];
}

beforeEach(() => {
  mocks.db.rows = [];
  mocks.db.roomWrites = [];
  mocks.db.rooms = [];
  mocks.db.roomFilters = [];
  mocks.db.reservationWrites = 0;
  mocks.db.removalFilters = [];
  mocks.alert.mockReset();
  mocks.alert.mockResolvedValue(undefined);
});

describe("airbnbCalendarUrlProblem", () => {
  it("accepts Airbnb calendar links", () => {
    expect(airbnbCalendarUrlProblem(URL_OK)).toBeNull();
    expect(airbnbCalendarUrlProblem("https://airbnb.co.uk/calendar/ical/1.ics")).toBeNull();
    expect(airbnbCalendarUrlProblem("https://WWW.AIRBNB.COM/calendar/ical/1.ics")).toBeNull();
    expect(airbnbCalendarUrlProblem("https://www.airbnb.com.au/calendar/ical/1.ics")).toBeNull();
  });
  it.each([
    "http://www.airbnb.com/calendar/ical/1.ics",
    "https://airbnb.com.evil.io/calendar/ical/1.ics",
    "https://www.airbnb.com/rooms/1",
    "http://169.254.169.254/",
    "https://www.airbnb.com/calendar/ical/" + "1".repeat(500),
    "not a url",
    "https://airbnb.evl.io/calendar/ical/1.ics",
    "https://airbnb.com.de/calendar/ical/1.ics",
    "https://airbnb.xyz/calendar/ical/1.ics",
    "https://www.airbnb.com@evil.io/calendar/ical/1.ics",
    "https://airbnb.com./calendar/ical/1.ics",
    "https://airbnb.com:8443/calendar/ical/1.ics",
  ])("refuses %s", (u: string) => {
    expect(airbnbCalendarUrlProblem(u)).toEqual(expect.any(String));
  });
});

describe("syncRoom", () => {
  it("inserts a new reservation with last_seen_at", async () => {
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics(["a", "20261210", "20261215"])) as never, now: NOW });
    expect(res).toEqual({ ok: true, added: 1, updated: 0, removed: 0 });
    expect(mocks.db.rows).toHaveLength(1);
    expect(mocks.db.rows[0]).toMatchObject({ uid: "a", check_in: "2026-12-10", check_out: "2026-12-15", last_seen_at: NOW.toISOString(), removed_at: null });
  });

  it("updates a moved reservation in place, keeping staff fields", async () => {
    mocks.db.rows = [row({})];
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics(["a", "20261210", "20261215"])) as never, now: NOW });
    expect(res).toEqual({ ok: true, added: 0, updated: 1, removed: 0 });
    expect(mocks.db.rows).toHaveLength(1);
    expect(mocks.db.rows[0]).toMatchObject({ check_in: "2026-12-10", check_out: "2026-12-15", guest_name: "Ama" });
  });

  it("marks a future row missing from the feed as removed", async () => {
    mocks.db.rows = [row({}), row({ id: "r2", uid: "b" })];
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics(["a", "20261201", "20261205"])) as never, now: NOW });
    expect(res).toMatchObject({ ok: true, removed: 1 });
    expect(mocks.db.rows[1].removed_at).toBe(NOW.toISOString());
    expect(mocks.db.rows[0].removed_at).toBeNull();
  });

  it("only removes rows not seen since this run started (a newer run wins)", async () => {
    // r2 was seen by a newer run that finished first; r3 was last seen before this run.
    mocks.db.rows = [
      row({ id: "r2", uid: "b", last_seen_at: "2026-11-13T10:00:05.000Z" }),
      row({ id: "r3", uid: "c", last_seen_at: "2026-11-13T09:00:00.000Z" }),
    ];
    await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics()) as never, now: NOW });
    expect(mocks.db.removalFilters).toEqual([
      expect.objectContaining({ "lt.last_seen_at": NOW.toISOString(), in: ["r2", "r3"] }),
    ]);
    expect(mocks.db.rows[0].removed_at).toBeNull();
    expect(mocks.db.rows[1].removed_at).toBe(NOW.toISOString());
  });

  it("fetches without following redirects and with a timeout signal", async () => {
    const fetchImpl = fetchOf(ics());
    await syncRoom(supabase, room(), { fetchImpl: fetchImpl as never, now: NOW });
    expect(fetchImpl).toHaveBeenCalledWith(URL_OK, expect.objectContaining({ redirect: "error", signal: expect.anything() }));
  });

  it("writes nothing and does not alert once its deadline has passed", async () => {
    mocks.db.rows = [row({ id: "r2", uid: "b" })];
    const res = await syncRoom(supabase, room(), {
      fetchImpl: fetchOf(ics(["a", "20261210", "20261215"])) as never, now: NOW, deadline: Date.now() - 1,
    });
    expect(res).toEqual({ ok: false, error: "Stopped: the sync ran out of time." });
    expect(mocks.db.reservationWrites).toBe(0);
    expect(mocks.db.roomWrites).toHaveLength(0);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("does not record a failure once its deadline has passed", async () => {
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf("x", 500) as never, now: NOW, deadline: Date.now() - 1 });
    expect(res).toEqual({ ok: false, error: "Stopped: the sync ran out of time." });
    expect(mocks.db.roomWrites).toHaveLength(0);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("leaves a past row missing from the feed alone", async () => {
    mocks.db.rows = [row({ id: "r2", uid: "old", check_in: "2026-10-01", check_out: "2026-10-05" })];
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics()) as never, now: NOW });
    expect(res).toMatchObject({ ok: true, removed: 0 });
    expect(mocks.db.rows[0].removed_at).toBeNull();
  });

  it("restores a removed uid that reappears", async () => {
    mocks.db.rows = [row({ removed_at: "2026-11-01T00:00:00Z" })];
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf(ics(["a", "20261201", "20261205"])) as never, now: NOW });
    expect(res).toMatchObject({ ok: true, updated: 1 });
    expect(mocks.db.rows[0].removed_at).toBeNull();
  });

  it("does not touch reservation rows when the body is not a calendar", async () => {
    mocks.db.rows = [row({})];
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf("<html>nope</html>") as never, now: NOW });
    expect(res.ok).toBe(false);
    expect(mocks.db.rows[0].removed_at).toBeNull();
    expect(mocks.db.rows[0].last_seen_at).toBe(SEEN_BEFORE);
    expect(lastRoomWrite().payload).toEqual({ airbnb_sync_error: expect.any(String) });
  });

  it("records an error when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("timeout"); });
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchImpl as never, now: NOW });
    expect(res.ok).toBe(false);
    expect(mocks.db.rows).toHaveLength(0);
    expect(lastRoomWrite().payload).toEqual({ airbnb_sync_error: expect.any(String) });
  });

  it("records an error on a 404", async () => {
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf("missing", 404) as never, now: NOW });
    expect(res.ok).toBe(false);
    expect(mocks.db.rows).toHaveLength(0);
    expect(lastRoomWrite().payload).toEqual({ airbnb_sync_error: expect.any(String) });
  });

  it("refuses a body over 1,000,000 characters", async () => {
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf("x".repeat(1_000_001)) as never, now: NOW });
    expect(res.ok).toBe(false);
  });

  it("sets airbnb_synced_at and clears the error on success", async () => {
    await syncRoom(supabase, room({ airbnb_sync_error: "old" }), { fetchImpl: fetchOf(ics()) as never, now: NOW });
    expect(lastRoomWrite().payload).toEqual({ airbnb_synced_at: NOW.toISOString(), airbnb_sync_error: null });
  });

  it("refuses a bad URL without calling fetch", async () => {
    const fetchImpl = fetchOf(ics());
    const res = await syncRoom(supabase, room({ airbnb_ical_url: "http://169.254.169.254/" }), { fetchImpl: fetchImpl as never, now: NOW });
    expect(res.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a missing URL", async () => {
    const res = await syncRoom(supabase, room({ airbnb_ical_url: null }), { fetchImpl: fetchOf(ics()) as never, now: NOW });
    expect(res.ok).toBe(false);
  });

  it("alerts the admin on the first failure only", async () => {
    const fetchImpl = fetchOf("x", 500) as never;
    await syncRoom(supabase, room(), { fetchImpl, now: NOW });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    await syncRoom(supabase, room({ airbnb_sync_error: "Airbnb answered with an error." }), { fetchImpl, now: NOW });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
  });

  it("does not leak the import URL into the alert, and survives a failing alert", async () => {
    mocks.alert.mockRejectedValue(new Error("resend down"));
    const res = await syncRoom(supabase, room(), { fetchImpl: fetchOf("x", 500) as never, now: NOW });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(mocks.alert.mock.calls)).not.toContain("abc");
  });
});

describe("syncRooms", () => {
  it("syncs every room with a URL and counts results", async () => {
    mocks.db.rooms = [room(), room({ id: "room-2", number: 5, airbnb_ical_url: "https://www.airbnb.com/calendar/ical/9.ics?bad=1" })];
    const fetchImpl = vi.fn(async (u: unknown) => new Response(ics(), { status: String(u).includes("bad") ? 500 : 200 }));
    const res = await syncRooms(supabase, { now: NOW, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ synced: 1, failed: 1 });
  });

  it("filters by unit and age", async () => {
    await syncRooms(supabase, { unitId: "u1", olderThanMinutes: 10, now: NOW });
    expect(mocks.db.roomFilters).toEqual(expect.arrayContaining(["eq.unit_id", "or.airbnb_synced_at.is.null,airbnb_synced_at"]));
  });

  it("a room still syncing when the timeout hits writes nothing afterwards", async () => {
    mocks.db.rooms = [room()];
    mocks.db.rows = [row({ id: "r2", uid: "b" })];
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve: (r: Response) => void) => setTimeout(() => resolve(new Response(ics(["a", "20261210", "20261215"]))), 60)),
    );
    const res = await syncRooms(supabase, { now: NOW, timeoutMs: 10, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ synced: 0, failed: 0 });
    await new Promise((resolve: (v: unknown) => void) => setTimeout(resolve, 120));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mocks.db.reservationWrites).toBe(0);
    expect(mocks.db.roomWrites).toHaveLength(0);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("skips rooms with a sync error when asked (booking refresh), leaving them to the scheduler", async () => {
    mocks.db.rooms = [room(), room({ id: "room-2", number: 5, airbnb_ical_url: "https://www.airbnb.com/calendar/ical/9.ics?s=1", airbnb_sync_error: "Airbnb answered with an error (404)." })];
    const fetchImpl = fetchOf(ics());
    const res = await syncRooms(supabase, { now: NOW, skipFailing: true, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ synced: 1, failed: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(URL_OK, expect.anything());
  });

  it("still syncs failing rooms by default", async () => {
    mocks.db.rooms = [room({ airbnb_sync_error: "old" })];
    const fetchImpl = fetchOf(ics());
    expect(await syncRooms(supabase, { now: NOW, fetchImpl: fetchImpl as never })).toEqual({ synced: 1, failed: 0 });
  });

  it("returns what finished when the timeout hits, without throwing", async () => {
    mocks.db.rooms = [room(), room({ id: "room-2", number: 5, airbnb_ical_url: "https://www.airbnb.com/calendar/ical/9.ics?s=1" })];
    const fetchImpl = vi.fn((u: unknown) =>
      String(u).includes("123") ? Promise.resolve(new Response(ics(), { status: 200 })) : new Promise<Response>(() => {}),
    );
    const res = await syncRooms(supabase, { now: NOW, timeoutMs: 50, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ synced: 1, failed: 0 });
  });
});
