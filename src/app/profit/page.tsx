import Link from "next/link";
import { supabase } from "@/lib/supabase";

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("ru-RU", {
    month: "short",
    year: "2-digit",
  });
}

function lastMonthKeys(count = 12) {
  const result: string[] = [];
  const now = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    result.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return result;
}

export default async function StatsPage() {
  const [ordersResult, paymentsResult, laborResult, partsResult] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "id, created_at, order_number, total_amount, parts_cost_total, gross_profit, margin_percent, client_id, clients(full_name)"
        ),
      supabase
        .from("work_order_payments")
        .select("amount, payment_date, payment_method"),
      supabase
        .from("work_order_labor_items")
        .select("description, quantity, unit_price, total"),
      supabase
        .from("work_order_part_items")
        .select("name, quantity, purchase_price, unit_price, profit, total"),
    ]);

  const orders = ordersResult.data || [];
  const payments = paymentsResult.data || [];
  const labor = laborResult.data || [];
  const parts = partsResult.data || [];

  const turnover = orders.reduce(
    (sum: number, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  const grossProfit = orders.reduce(
    (sum: number, order: any) => sum + Number(order.gross_profit || 0),
    0
  );

  const partsCost = orders.reduce(
    (sum: number, order: any) => sum + Number(order.parts_cost_total || 0),
    0
  );

  const received = payments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const averageMargin = turnover > 0 ? (grossProfit / turnover) * 100 : 0;

  const monthlyKeys = lastMonthKeys();
  const monthlyTurnover = new Map(monthlyKeys.map((key) => [key, 0]));
  const monthlyProfit = new Map(monthlyKeys.map((key) => [key, 0]));

  for (const order of orders as any[]) {
    if (!order.created_at) continue;
    const key = monthKey(order.created_at);
    if (!monthlyTurnover.has(key)) continue;

    monthlyTurnover.set(
      key,
      Number(monthlyTurnover.get(key) || 0) + Number(order.total_amount || 0)
    );

    monthlyProfit.set(
      key,
      Number(monthlyProfit.get(key) || 0) + Number(order.gross_profit || 0)
    );
  }

  const monthlyRows = monthlyKeys.map((key) => ({
    key,
    label: monthLabel(key),
    turnover: Number(monthlyTurnover.get(key) || 0),
    profit: Number(monthlyProfit.get(key) || 0),
  }));

  const maxValue = Math.max(
    1,
    ...monthlyRows.map((row) => Math.max(row.turnover, row.profit))
  );

  const topOrders = [...orders]
    .sort(
      (a: any, b: any) =>
        Number(b.gross_profit || 0) - Number(a.gross_profit || 0)
    )
    .slice(0, 8);

  const topParts = [...parts]
    .sort(
      (a: any, b: any) => Number(b.profit || 0) - Number(a.profit || 0)
    )
    .slice(0, 8);

  const topServices = [...labor]
    .map((item: any) => ({
      name: item.description || "Работа",
      total: Number(
        item.total ??
          Number(item.quantity || 0) * Number(item.unit_price || 0)
      ),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">
            Прибыль и маржа
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Оборот, себестоимость и прибыль SRV AUTO
          </p>
        </div>

        <Link
          href="/stats"
          className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold"
        >
          Общая статистика
        </Link>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Оборот" value={money(turnover)} accent="text-white" />
        <Metric title="Получено оплат" value={money(received)} accent="text-green-400" />
        <Metric title="Себестоимость деталей" value={money(partsCost)} accent="text-blue-400" />
        <Metric title="Валовая прибыль" value={money(grossProfit)} accent="text-green-400" />
        <Metric title="Средняя маржа" value={`${averageMargin.toFixed(1)} %`} accent="text-orange-400" />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-bold text-green-400">Оборот и прибыль за 12 месяцев</h2>

        <div className="mt-6 flex h-72 items-end gap-2">
          {monthlyRows.map((row) => (
            <div key={row.key} className="flex min-w-0 flex-1 items-end justify-center gap-1">
              <div
                className="w-1/2 rounded-t bg-zinc-500"
                style={{ height: `${Math.max(3, (row.turnover / maxValue) * 100)}%` }}
                title={`Оборот ${row.label}: ${money(row.turnover)}`}
              />
              <div
                className="w-1/2 rounded-t bg-green-500"
                style={{ height: `${Math.max(3, (row.profit / maxValue) * 100)}%` }}
                title={`Прибыль ${row.label}: ${money(row.profit)}`}
              />
              <span className="absolute mt-6 hidden" />
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-12 gap-2 text-center text-[10px] text-zinc-500">
          {monthlyRows.map((row) => (
            <span key={row.key}>{row.label}</span>
          ))}
        </div>

        <div className="mt-4 flex gap-5 text-xs text-zinc-400">
          <span>Серый — оборот</span>
          <span>Зелёный — прибыль</span>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListCard
          title="Самые прибыльные заказы"
          rows={topOrders.map((order: any) => ({
            title: order.order_number || "Заказ",
            subtitle: order.clients?.full_name || "-",
            value: money(order.gross_profit),
          }))}
          accent="text-green-400"
        />

        <ListCard
          title="Самые прибыльные детали"
          rows={topParts.map((item: any) => ({
            title: item.name || "Запчасть",
            subtitle: `Продажа ${money(item.total)} · Закупка ${money(
              Number(item.purchase_price || 0) * Number(item.quantity || 0)
            )}`,
            value: money(item.profit),
          }))}
          accent="text-blue-400"
        />

        <ListCard
          title="Самые доходные работы"
          rows={topServices.map((item) => ({
            title: item.name,
            subtitle: "Работа",
            value: money(item.total),
          }))}
          accent="text-orange-400"
        />
      </section>
    </main>
  );
}

function Metric({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function ListCard({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: { title: string; subtitle: string; value: string }[];
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className={`font-bold ${accent}`}>{title}</h2>

      <div className="mt-4 space-y-2">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={`${row.title}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="truncate text-xs text-zinc-500">{row.subtitle}</p>
              </div>
              <p className={`shrink-0 font-bold ${accent}`}>{row.value}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Данных пока нет.</p>
        )}
      </div>
    </div>
  );
}