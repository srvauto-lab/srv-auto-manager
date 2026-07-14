"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";
import WorkOrderSignature from "@/components/WorkOrderSignature";
import WorkOrderHistory from "@/components/WorkOrderHistory";
import {
  normalizeWorkOrderStatus,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_COLORS,
} from "@/lib/workOrderStatus";

type Props = {
  order: any;
  children: React.ReactNode;
  checklist: React.ReactNode;
  documents: React.ReactNode;
  photos: React.ReactNode;
};

export default function WorkOrderShell({
  order,
  children,
  checklist,
  documents,
  photos,
}: Props) {
  const router = useRouter();

  const [tab, setTab] = useState("main");
  const [currentStatus, setCurrentStatus] = useState(
    normalizeWorkOrderStatus(order.status)
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  async function changeStatus(nextStatus: string) {
    if (savingStatus || currentStatus === nextStatus) return;

    const previousStatus = currentStatus;
    const normalizedNextStatus = normalizeWorkOrderStatus(nextStatus);

    setSavingStatus(true);

    const { error: updateError } = await supabase
      .from("work_orders")
      .update({ status: normalizedNextStatus })
      .eq("id", order.id);

    if (updateError) {
      setSavingStatus(false);
      alert(updateError.message);
      return;
    }

    const { error: historyError } = await supabase
      .from("work_order_history")
      .insert({
        work_order_id: order.id,
        action: "Изменён статус",
        description: `${previousStatus} → ${normalizedNextStatus}`,
        user_name: null,
        color: "yellow",
      });

    if (historyError) {
      alert(
        `Статус сохранён, но запись в историю не добавлена: ${historyError.message}`
      );
    }

    setCurrentStatus(normalizedNextStatus);
    setHistoryVersion((version) => version + 1);
    setSavingStatus(false);

    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="h-fit rounded-xl border border-zinc-800 bg-zinc-900 p-6 xl:sticky xl:top-6">
        <h2 className="text-xl font-bold text-green-400">Карточка</h2>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <p className="text-zinc-500">Клиент</p>
            <p className="font-bold">{order.clients?.full_name || "-"}</p>
            <p className="text-zinc-400">{order.clients?.phone || "-"}</p>
            <p className="text-zinc-400">{order.clients?.email || "-"}</p>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-zinc-500">Автомобиль</p>

            <p className="font-bold">
              {order.vehicles?.brand || "-"} {order.vehicles?.model || ""}
            </p>

            <p className="text-zinc-400">
              Номер: {order.vehicles?.plate || "-"}
            </p>

            <p className="text-zinc-400">
              VIN: {order.vehicles?.vin || "-"}
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-zinc-500">Заказ-наряд</p>

            <p className="font-bold text-green-400">
              {order.order_number || "-"}
            </p>

            <div className="mt-2">
              <StatusBadge status={currentStatus} />
            </div>

            <p className="mt-2 text-zinc-400">
              Пробег: {order.mileage || "-"}
            </p>

            <p className="text-zinc-400">
              Итого: {Number(order.total_amount || 0).toFixed(2)} €
            </p>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-green-400">
              Этап ремонта
            </h2>

            {savingStatus && (
              <span className="text-sm text-zinc-400">
                Сохраняем...
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {WORK_ORDER_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => changeStatus(status)}
                disabled={savingStatus}
                className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  currentStatus === status
                    ? WORK_ORDER_STATUS_COLORS[status]
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["main", "Основное"],
            ["checklist", "Приёмка"],
            ["photos", "Фото"],
            ["documents", "Документы"],
            ["signature", "Подпись"],
            ["history", "История"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-3 font-bold ${
                tab === key
                  ? "bg-green-500 text-black"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 min-w-0">
          {tab === "main" && children}

          {tab === "checklist" && checklist}

          {tab === "photos" && photos}

          {tab === "documents" && documents}

          {tab === "signature" && (
            <WorkOrderSignature workOrderId={order.id} />
          )}

          {tab === "history" && (
            <WorkOrderHistory
              key={`${order.id}-${historyVersion}`}
              workOrderId={order.id}
            />
          )}
        </div>
      </section>
    </div>
  );
}