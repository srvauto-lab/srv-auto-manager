"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";

type WorkOrder = {
  id: string;
  order_number: string | null;
  created_at: string;
  mileage: string | null;
  customer_complaint: string | null;
  status: string;
  total_amount: number | null;
  clients?: { full_name: string; phone?: string | null } | null;
  vehicles?: {
    brand: string;
    model: string;
    plate: string | null;
    vin?: string | null;
  } | null;
};

const statuses = [
  "all",
  "Записан",
  "Принят",
  "Диагностика",
  "Ожидание запчастей",
  "В работе",
  "Готов",
  "Выдан",
  "Закрыт",
];

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_orders")
      .select(
        "*, clients(full_name, phone), vehicles(brand, model, plate, vin)"
      )
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setOrders(data || []);

    setLoading(false);
  }

  async function deleteOrder(id: string) {
  if (
    !confirm(
      "Удалить заказ-наряд? Все списанные запчасти будут возвращены на склад."
    )
  ) {
    return;
  }

  const { data: parts, error: partsError } = await supabase
    .from("work_order_part_items")
    .select("id, inventory_item_id, quantity, stock_deducted, name")
    .eq("work_order_id", id);

  if (partsError) {
    alert(partsError.message);
    return;
  }

  for (const part of parts || []) {
    if (!part.inventory_item_id || !part.stock_deducted) continue;

    const quantityToReturn = Number(part.quantity || 0);

    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("id", part.inventory_item_id)
      .single();

    if (inventoryError || !inventoryItem) {
      alert(inventoryError?.message || "Позиция склада не найдена");
      return;
    }

    const nextQuantity =
      Number(inventoryItem.quantity || 0) + quantityToReturn;

    const { error: updateInventoryError } = await supabase
      .from("inventory")
      .update({ quantity: nextQuantity })
      .eq("id", part.inventory_item_id);

    if (updateInventoryError) {
      alert(updateInventoryError.message);
      return;
    }

    const { error: movementError } = await supabase
      .from("inventory_movements")
      .insert({
        inventory_item_id: part.inventory_item_id,
        work_order_id: id,
        work_order_part_item_id: part.id,
        movement_type: "return_on_work_order_delete",
        quantity: quantityToReturn,
        note: `Возврат на склад при удалении заказ-наряда: ${
          part.name || ""
        }`,
      });

    if (movementError) {
      alert(movementError.message);
      return;
    }
  }

  const { error } = await supabase.from("work_orders").delete().eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadOrders();
}

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;

      const text = [
        order.order_number,
        order.clients?.full_name,
        order.clients?.phone,
        order.vehicles?.brand,
        order.vehicles?.model,
        order.vehicles?.plate,
        order.vehicles?.vin,
        order.customer_complaint,
        order.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!q || text.includes(q));
    });
  }, [orders, search, statusFilter]);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Заказ-наряды</h1>
          <p className="mt-2 text-zinc-400">Работы и ремонты SRV AUTO</p>
        </div>

        <Link
          href="/work-orders/new"
          className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400"
        >
          Создать заказ-наряд
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <input
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
          placeholder="Поиск: номер, клиент, телефон, VIN, госномер..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "Все статусы" : status}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1450px] grid-cols-8 border-b border-zinc-800 p-4 text-sm font-semibold text-zinc-400">
          <div>№</div>
          <div>Клиент</div>
          <div>Автомобиль</div>
          <div>Пробег</div>
          <div>Жалоба</div>
          <div>Статус</div>
          <div>Сумма</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filteredOrders.length ? (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="grid min-w-[1450px] grid-cols-8 border-b border-zinc-800 p-4 text-sm"
            >
              <div className="font-bold text-green-400">
                {order.order_number || "-"}
              </div>

              <div>
                <p>{order.clients?.full_name || "-"}</p>
                <p className="text-xs text-zinc-500">
                  {order.clients?.phone || ""}
                </p>
              </div>

              <div>
                {order.vehicles ? (
                  <>
                    <p>
                      {order.vehicles.brand} {order.vehicles.model}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {order.vehicles.plate || "-"} · VIN:{" "}
                      {order.vehicles.vin || "-"}
                    </p>
                  </>
                ) : (
                  "-"
                )}
              </div>

              <div>{order.mileage || "-"}</div>
              <div>{order.customer_complaint || "-"}</div>
              <div>
                <StatusBadge status={order.status} />
              </div>
              <div>{Number(order.total_amount || 0).toFixed(2)} €</div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/work-orders/${order.id}`}
                  className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  Открыть
                </Link>

                <button
                  onClick={() => deleteOrder(order.id)}
                  className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Заказ-нарядов не найдено.</div>
        )}
      </div>
    </main>
  );
}