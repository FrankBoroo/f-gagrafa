import { formatMoney } from "@/lib/format";
import type { TodayView } from "@/lib/admin/today";

export function TodayNumbers({ view }: { view: TodayView }) {
  const items = [
    { label: "Arriving today", value: String(view.arriving.length) },
    { label: "Leaving today", value: String(view.leaving.length) },
    { label: "Occupied tonight", value: `${view.occupiedTonight} of ${view.roomCount}` },
    { label: "Balances owed", value: formatMoney(view.balancesOwed, "GHS") },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card p-5">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="mt-2 font-display text-3xl text-navy">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
