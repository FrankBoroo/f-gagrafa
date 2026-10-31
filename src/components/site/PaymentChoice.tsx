// One way to pay, as a radio card. Used on the apartment page panel and at checkout.
export function PaymentChoice({
  checked, onSelect, title, amount, note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  amount: string;
  note?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-champagne ${
        checked ? "border-champagne bg-champagne/10" : "border-sand bg-white hover:border-navy/30"
      }`}
    >
      <input type="radio" name="payment_option" checked={checked} onChange={onSelect} className="mt-1 accent-navy" />
      <span>
        <span className="block text-sm text-navy">{title} · {amount}</span>
        {note && <span className="mt-1 block text-xs text-navy/70">{note}</span>}
      </span>
    </label>
  );
}
