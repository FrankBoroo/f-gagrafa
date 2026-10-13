"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUnit } from "@/app/admin/units/actions";

export function DeleteUnitButton({ unitId, unitName }: { unitId: string; unitName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Permanently delete "${unitName}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteUnit(unitId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete");
        return;
      }
      toast.success("Residence deleted");
      router.push("/admin/units");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      className="rounded-full border border-red-200 px-6 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete this residence"}
    </button>
  );
}
