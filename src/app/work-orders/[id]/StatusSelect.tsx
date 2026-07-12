"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();

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
      <option value="Nouveau">Nouveau</option>
      <option value="En cours">En cours</option>
      <option value="En attente pièces">En attente pièces</option>
      <option value="Terminé">Terminé</option>
      <option value="Facturé">Facturé</option>
    </select>
  );
}