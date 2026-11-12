import { describe, it, expect } from "vitest";
import { receiptFromRow } from "@/lib/receipt";

const row = (over: Record<string, unknown> = {}) => ({
  booking_code: "GAG-1",
  guest_name: "Ama",
  check_in: "2026-12-20",
  check_out: "2026-12-23",
  status: "confirmed",
  total_amount: "900",
  currency: "GHS",
  room_confirmed: false,
  units: { name: "Studio" },
  rooms: { number: 8 },
  payments: [],
  ...over,
});

describe("receiptFromRow", () => {
  it("hides an unconfirmed room", () => {
    expect(receiptFromRow(row()).booking.room).toBeNull();
    expect(receiptFromRow(row({ room_confirmed: true })).booking.room).toBe("Room 8");
  });

  it("sorts payments by date and keeps refunds negative", () => {
    const { payments } = receiptFromRow(
      row({
        payments: [
          { id: "b", amount: "-100", status: "refunded", method: "paystack", paid_at: "2026-12-01T10:00:00Z", created_at: null },
          { id: "a", amount: "500", status: "success", method: "paystack", paid_at: "2026-11-01T10:00:00Z", created_at: null },
        ],
      })
    );
    expect(payments.map((p) => p.id)).toEqual(["a", "b"]);
    expect(payments[1].amount).toBe(-100);
  });
});
