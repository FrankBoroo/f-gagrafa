import { redirect } from "next/navigation";

// Service requests now live in the Inbox, next to cancellation requests and messages.
export default function AdminServiceRequestsPage() {
  redirect("/admin/inbox");
}
