import { redirect } from "next/navigation";

// Until the Money overview (Phase 3, Task 10) lands, Money opens Payments.
export default function AdminMoneyPage() {
  redirect("/admin/payments");
}
