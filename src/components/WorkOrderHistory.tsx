"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type HistoryItem = {
  id: string;
  created_at: string;
  action: string;
  description: string | null;
  user_name: string | null;
  color: string | null;
};

const colors: Record<string, string> = {
  green: "border-green-500 bg-green-500/10",
  yellow: "border-yellow-500 bg-yellow-500/10",
  blue: "border-blue-500 bg-blue-500/10",
  red: "border-red-500 bg-red-500/10",
  gray: "border-zinc-700 bg-zinc-800/30",
};

export default function WorkOrderHistory({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_order_history")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        Загрузка истории...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">
        История заказ-наряда
      </h2>

      {items.length === 0 ? (
        <p className="mt-6 text-zinc-500">
          Пока история пустая.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 ${
                colors[item.color || "gray"]
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">
                  {item.action}
                </h3>

                <span className="text-xs text-zinc-400">
                  {new Date(item.created_at).toLocaleString("fr-FR")}
                </span>
              </div>

              {item.description && (
                <p className="mt-2 text-sm text-zinc-300">
                  {item.description}
                </p>
              )}

              {item.user_name && (
                <p className="mt-2 text-xs text-zinc-500">
                  Пользователь: {item.user_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}