"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function StatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const { settings } = useAppSettings();

  async function updateStatus(status: string) {
    const { error } = await supabase
      .from("work_orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <select
      className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-green-400"
      defaultValue={currentStatus}
      onChange={(e) => updateStatus(e.target.value)}
    >
      {!settings.work_order_statuses.includes(currentStatus) && currentStatus && (
        <option value={currentStatus}>{currentStatus}</option>
      )}
      {settings.work_order_statuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}