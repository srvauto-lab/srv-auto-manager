import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const [
    ordersResult,
    paymentsResult,
    devisResult,
    facturesResult,
    laborResult,
    partsResult,
    clientsResult,
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, created_at, status, total_amount, paid_amount, client_id, clients(full_name)"
      ),

    supabase
      .from("work_order_payments")
      .select("id, amount, payment_date, payment_method, work_order_id"),

    supabase
      .from("devis")
      .select("id, created_at, total_ttc, status"),

    supabase
      .from("factures")
      .select("id, created_at, total_ttc, status"),

    supabase
      .from("work_order_labor_items")
      .select("id, work_order_id, description, quantity, unit_price, total"),

    supabase
      .from("work_order_part_items")
      .select("id, work_order_id, name, quantity, unit_price, total"),

    supabase.from("clients").select("id, full_name"),
  ]);

  const errors = [
    ordersResult.error,
    paymentsResult.error,
    devisResult.error,
    facturesResult.error,
    laborResult.error,
    partsResult.error,
    clientsResult.error,
  ].filter(Boolean);

  if (errors.length) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        <h1 className="text-3xl font-bold text-green-400">Статистика</h1>
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-5 text-red-300">
          {errors.map((error: any, index) => (
            <p key={index}>{error.message}</p>
          ))}
        </div>
      </main>
    );
  }

  const orders = ordersResult.data || [];
  const payments = paymentsResult.data || [];
  const devis = devisResult.data || [];
  const factures = facturesResult.data || [];
  const labor = laborResult.data || [];
  const parts = partsResult.data || [];
  const clients = clientsResult.data || [];

  const totalReceived = payments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const totalInvoiced = factures.reduce(
    (sum: number, facture: any) => sum + Number(facture.total_ttc || 0),
    0
  );

  const totalQuoted = devis.reduce(
    (sum: number, document: any) => sum + Number(document.total_ttc || 0),
    0
  );

  const totalOrdersValue = orders.reduce(
    (sum: number, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  const totalUnpaid = orders.reduce((sum: number, order: any) => {
    const total = Number(order.total_amount || 0);
    const paid = Number(order.paid_amount || 0);
    return sum + Math.max(0, total - paid);
  }, 0);

  const averageOrder =
    orders.length > 0 ? totalOrdersValue / orders.length : 0;

  const paidOrders = orders.filter((order: any) => {
    const total = Number(order.total_amount || 0);
    const paid = Number(order.paid_amount || 0);
    return total > 0 && paid >= total;
  }).length;

  const conversionRate =
    devis.length > 0
      ? (devis.filter(
          (document: any) =>
            document.status === "accepted" ||
            document.status === "converted" ||
            document.converted_to_facture
        ).length /
          devis.length) *
        100
      : 0;

  const monthlyKeys = lastMonthKeys(12);
  const monthlyRevenue = new Map(monthlyKeys.map((key) => [key, 0]));

  for (const payment of payments as any[]) {
    if (!payment.payment_date) continue;
    const key = monthKey(payment.payment_date);
    if (monthlyRevenue.has(key)) {
      monthlyRevenue.set(
        key,
        Number(monthlyRevenue.get(key) || 0) + Number(payment.amount || 0)
      );
    }
  }

  const monthlyRows = monthlyKeys.map((key) => ({
    key,
    label: monthLabel(key),
    value: Number(monthlyRevenue.get(key) || 0),
  }));

  const maxMonthlyRevenue = Math.max(
    1,
    ...monthlyRows.map((row) => row.value)
  );

  const serviceTotals = new Map<
    string,
    { name: string; quantity: number; total: number }
  >();

  for (const item of labor as any[]) {
    const name = String(item.description || "Работа без названия").trim();
    const current = serviceTotals.get(name) || {
      name,
      quantity: 0,
      total: 0,
    };

    current.quantity += Number(item.quantity || 0);
    current.total += Number(
      item.total ??
        Number(item.quantity || 0) * Number(item.unit_price || 0)
    );

    serviceTotals.set(name, current);
  }

  const topServices = [...serviceTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const clientTotals = new Map<
    string,
    { id: string; name: string; orders: number; total: number }
  >();

  for (const order of orders as any[]) {
    const clientId = String(order.client_id || "unknown");
    const clientName = order.clients?.full_name || "Клиент не указан";
    const current = clientTotals.get(clientId) || {
      id: clientId,
      name: clientName,
      orders: 0,
      total: 0,
    };

    current.orders += 1;
    current.total += Number(order.total_amount || 0);

    clientTotals.set(clientId, current);
  }

  const topClients = [...clientTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const statusCounts = new Map<string, number>();

  for (const order of orders as any[]) {
    const status = order.status || "Без статуса";
    statusCounts.set(status, Number(statusCounts.get(status) || 0) + 1);
  }

  const statusRows = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const paymentMethodTotals = new Map<string, number>();

  for (const payment of payments as any[]) {
    const method = payment.payment_method || "Не указан";
    paymentMethodTotals.set(
      method,
      Number(paymentMethodTotals.get(method) || 0) +
        Number(payment.amount || 0)
    );
  }

  const paymentMethodRows = [...paymentMethodTotals.entries()]
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);

  const laborRevenue = labor.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.total ??
          Number(item.quantity || 0) * Number(item.unit_price || 0)
      ),
    0
  );

  const partsRevenue = parts.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.total ??
          Number(item.quantity || 0) * Number(item.unit_price || 0)
      ),
    0
  );

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Статистика</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Финансы и показатели SRV AUTO
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700"
        >
          Панель управления
        </Link>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Получено оплат"
          value={money(totalReceived)}
          detail={`${payments.length} платежей`}
          className="text-green-400"
        />

        <MetricCard
          title="Выставлено Facture"
          value={money(totalInvoiced)}
          detail={`${factures.length} документов`}
          className="text-blue-400"
        />

        <MetricCard
          title="Не оплачено"
          value={money(totalUnpaid)}
          detail={`${orders.length - paidOrders} заказов с остатком`}
          className="text-orange-400"
        />

        <MetricCard
          title="Средний заказ"
          value={money(averageOrder)}
          detail={`${orders.length} заказов всего`}
          className="text-white"
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallMetric title="Devis" value={devis.length} />
        <SmallMetric
          title="Конверсия Devis"
          value={`${conversionRate.toFixed(1)} %`}
        />
        <SmallMetric title="Оплачено полностью" value={paidOrders} />
        <SmallMetric title="Клиенты" value={clients.length} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-green-400">
                Поступления за 12 месяцев
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                По фактически зарегистрированным платежам
              </p>
            </div>

            <p className="text-xl font-bold">{money(totalReceived)}</p>
          </div>

          <div className="mt-6 flex h-64 items-end gap-2">
            {monthlyRows.map((row) => {
              const height = Math.max(
                4,
                Math.round((row.value / maxMonthlyRevenue) * 100)
              );

              return (
                <div
                  key={row.key}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <p className="mb-2 hidden text-[10px] text-zinc-500 2xl:block">
                    {row.value > 0 ? money(row.value) : ""}
                  </p>

                  <div
                    className="w-full rounded-t bg-green-500"
                    style={{ height: `${height}%` }}
                    title={`${row.label}: ${money(row.value)}`}
                  />

                  <p className="mt-2 text-[10px] text-zinc-500">
                    {row.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-blue-400">Структура продаж</h2>

          <div className="mt-5 space-y-4">
            <ProgressRow
              label="Работы"
              value={laborRevenue}
              total={laborRevenue + partsRevenue}
            />

            <ProgressRow
              label="Запчасти"
              value={partsRevenue}
              total={laborRevenue + partsRevenue}
            />
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-5">
            <p className="text-xs text-zinc-500">
              Общая стоимость заказов
            </p>
            <p className="mt-2 text-2xl font-bold">
              {money(totalOrdersValue)}
            </p>
          </div>

          <div className="mt-5 border-t border-zinc-800 pt-5">
            <p className="text-xs text-zinc-500">Сумма всех Devis</p>
            <p className="mt-2 text-xl font-bold text-yellow-400">
              {money(totalQuoted)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-green-400">Самые доходные работы</h2>

          <div className="mt-4 space-y-2">
            {topServices.length ? (
              topServices.map((service, index) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between gap-4 rounded-lg bg-zinc-950 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {index + 1}. {service.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Количество: {service.quantity}
                    </p>
                  </div>

                  <p className="shrink-0 font-bold text-green-400">
                    {money(service.total)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Данных пока нет.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-blue-400">Лучшие клиенты</h2>

          <div className="mt-4 space-y-2">
            {topClients.length ? (
              topClients.map((client, index) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-4 rounded-lg bg-zinc-950 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {index + 1}. {client.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Заказов: {client.orders}
                    </p>
                  </div>

                  <p className="shrink-0 font-bold text-blue-400">
                    {money(client.total)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Данных пока нет.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-yellow-400">
            Заказы по статусам
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {statusRows.map((row) => (
              <div
                key={row.status}
                className="flex items-center justify-between rounded-lg bg-zinc-950 p-3"
              >
                <span className="text-sm">{row.status}</span>
                <span className="font-bold text-yellow-400">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-purple-400">
            Способы оплаты
          </h2>

          <div className="mt-4 space-y-3">
            {paymentMethodRows.length ? (
              paymentMethodRows.map((row) => (
                <div
                  key={row.method}
                  className="flex items-center justify-between rounded-lg bg-zinc-950 p-3"
                >
                  <span className="text-sm">{row.method}</span>
                  <span className="font-bold text-purple-400">
                    {money(row.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Платежей пока нет.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  detail,
  className,
}: {
  title: string;
  value: string;
  detail: string;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className={`mt-2 text-3xl font-black ${className}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function SmallMetric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-bold">{money(value)}</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-green-500"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      <p className="mt-1 text-right text-xs text-zinc-500">
        {percentage.toFixed(1)} %
      </p>
    </div>
  );
}
