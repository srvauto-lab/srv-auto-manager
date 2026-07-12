import Link from "next/link";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function localDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfTodayIso() {
  const parisDate = localDateString();
  return new Date(`${parisDate}T00:00:00+02:00`).toISOString();
}

function startOfMonthIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";

  return new Date(`${year}-${month}-01T00:00:00+02:00`).toISOString();
}

function daysSince(value: string | null | undefined) {
  if (!value) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  );
}

export default async function Home() {
  const today = localDateString();
  const todayStart = startOfTodayIso();
  const monthStart = startOfMonthIso();

  const [
    activeOrdersResult,
    readyOrdersResult,
    waitingPartsResult,
    todayAppointmentsResult,
    todayPaymentsResult,
    monthPaymentsResult,
    unpaidOrdersResult,
    lowStockResult,
    recommendationsResult,
    devisResult,
    facturesResult,
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, order_number, status, total_amount, paid_amount, clients(full_name), vehicles(brand, model, plate)"
      )
      .in("status", ["Принят", "Диагностика", "Ожидание запчастей", "В работе"])
      .order("created_at", { ascending: false })
      .limit(12),

    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Готов"),

    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Ожидание запчастей"),

    supabase
      .from("appointments")
      .select(
        "id, start_time, end_time, title, status, lift, mechanic, clients(full_name, phone), vehicles(brand, model, plate)"
      )
      .eq("appointment_date", today)
      .order("start_time", { ascending: true }),

    supabase
      .from("work_order_payments")
      .select("amount")
      .gte("payment_date", todayStart),

    supabase
      .from("work_order_payments")
      .select("amount")
      .gte("payment_date", monthStart),

    supabase
      .from("work_orders")
      .select(
        "id, order_number, total_amount, paid_amount, payment_status, clients(full_name), vehicles(brand, model, plate)"
      )
      .gt("total_amount", 0)
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("inventory")
      .select(
        "id, name, part_number, manufacturer, quantity, min_quantity, location"
      )
      .order("quantity", { ascending: true })
      .limit(30),

    supabase
      .from("vehicle_recommendations")
      .select(
        "id, title, description, due_mileage, due_date, vehicles(id, brand, model, plate)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("devis")
      .select(
        "id, devis_number, created_at, status, total_ttc, work_order_id, lang, seller, work_orders(clients(full_name), vehicles(brand, model, plate))"
      )
      .order("created_at", { ascending: false })
      .limit(4),

    supabase
      .from("factures")
      .select(
        "id, facture_number, created_at, status, total_ttc, work_order_id, lang, seller, work_orders(paid_amount, clients(full_name), vehicles(brand, model, plate))"
      )
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const activeOrders = activeOrdersResult.data || [];
  const todayAppointments = todayAppointmentsResult.data || [];
  const recommendations = recommendationsResult.data || [];
  const devis = devisResult.data || [];
  const factures = facturesResult.data || [];

  const todayRevenue = (todayPaymentsResult.data || []).reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const monthRevenue = (monthPaymentsResult.data || []).reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const unpaidOrders = (unpaidOrdersResult.data || [])
    .map((order: any) => ({
      ...order,
      remaining: Math.max(
        0,
        Number(order.total_amount || 0) - Number(order.paid_amount || 0)
      ),
    }))
    .filter((order: any) => order.remaining > 0);

  const unpaidTotal = unpaidOrders.reduce(
    (sum: number, order: any) => sum + Number(order.remaining || 0),
    0
  );

  const lowStockItems = (lowStockResult.data || [])
    .filter(
      (item: any) =>
        Number(item.quantity || 0) <= Number(item.min_quantity || 0)
    )
    .slice(0, 6);

  const unpaidFactures = factures
    .filter((doc: any) => {
      const paid = Number(doc.work_orders?.paid_amount || 0);
      const total = Number(doc.total_ttc || 0);
      return doc.status !== "paid" && doc.status !== "cancelled" && paid < total;
    })
    .slice(0, 4);

  const recentDocuments = [
    ...devis.map((doc: any) => ({
      ...doc,
      kind: "devis" as const,
      number: doc.devis_number,
    })),
    ...factures.map((doc: any) => ({
      ...doc,
      kind: "facture" as const,
      number: doc.facture_number,
    })),
  ]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">
            Панель управления
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Главное по SRV AUTO на сегодня
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/work-orders/new"
            className="rounded-lg bg-green-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-green-400"
          >
            + Новый заказ
          </Link>
          <Link
            href="/clients"
            className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700"
          >
            + Клиент
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700"
          >
            Календарь
          </Link>
          <Link
            href="/inventory"
            className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700"
          >
            Склад
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-5">
          <p className="text-sm text-zinc-400">Получено сегодня</p>
          <p className="mt-2 text-3xl font-black text-green-400">
            {money(todayRevenue)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            За месяц: {money(monthRevenue)}
          </p>
        </div>

        <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 p-5">
          <p className="text-sm text-zinc-400">Не оплачено</p>
          <p className="mt-2 text-3xl font-black text-orange-400">
            {money(unpaidTotal)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Заказов с остатком: {unpaidOrders.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Машин в работе</p>
          <p className="mt-2 text-3xl font-black text-green-400">
            {activeOrders.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Записей сегодня</p>
          <p className="mt-2 text-3xl font-black text-blue-400">
            {todayAppointments.length}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">Готово</p>
            <p className="mt-2 text-2xl font-black text-emerald-400">
              {readyOrdersResult.count || 0}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">Ждут детали</p>
            <p className="mt-2 text-2xl font-black text-yellow-400">
              {waitingPartsResult.count || 0}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="font-bold text-green-400">Активные заказы</h2>
              <p className="text-xs text-zinc-500">
                Последние машины в работе
              </p>
            </div>
            <Link
              href="/work-orders"
              className="text-sm font-semibold text-zinc-400 hover:text-green-400"
            >
              Все заказы →
            </Link>
          </div>

          <div className="divide-y divide-zinc-800">
            {activeOrders.length ? (
              activeOrders.map((order: any) => {
                const total = Number(order.total_amount || 0);
                const paid = Number(order.paid_amount || 0);
                const remaining = Math.max(0, total - paid);

                return (
                  <Link
                    key={order.id}
                    href={`/work-orders/${order.id}`}
                    className="grid gap-3 px-5 py-4 hover:bg-zinc-800/60 md:grid-cols-[140px_1fr_1fr_130px_110px]"
                  >
                    <p className="font-bold text-green-400">
                      {order.order_number || "Без номера"}
                    </p>

                    <p className="truncate font-semibold">
                      {order.clients?.full_name || "Клиент не указан"}
                    </p>

                    <div className="min-w-0">
                      <p className="truncate text-zinc-300">
                        {order.vehicles
                          ? `${order.vehicles.brand} ${order.vehicles.model}`
                          : "Автомобиль не указан"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {order.vehicles?.plate || ""}
                      </p>
                    </div>

                    <div>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="text-right">
                      <p className="font-bold">{money(total)}</p>
                      {remaining > 0 && (
                        <p className="text-xs text-orange-400">
                          Остаток {money(remaining)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="p-6 text-zinc-500">Активных заказов нет.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-blue-400">Сегодня</h2>
              <Link
                href="/calendar"
                className="text-xs text-zinc-500 hover:text-blue-400"
              >
                Открыть календарь
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {todayAppointments.length ? (
                todayAppointments.slice(0, 6).map((appointment: any) => (
                  <Link
                    key={appointment.id}
                    href="/calendar"
                    className="flex gap-3 rounded-lg bg-zinc-950 p-3 hover:bg-zinc-800"
                  >
                    <div className="w-14 shrink-0 font-bold text-blue-400">
                      {appointment.start_time?.slice(0, 5) || "--:--"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {appointment.title || "Запись"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {appointment.clients?.full_name ||
                          appointment.vehicles?.plate ||
                          "Клиент не указан"}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Записей нет.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-orange-900/40 bg-orange-950/10 p-5">
            <h2 className="font-bold text-orange-400">
              Неоплаченные фактуры
            </h2>

            <div className="mt-4 space-y-3">
              {unpaidFactures.length ? (
                unpaidFactures.map((doc: any) => {
                  const paid = Number(doc.work_orders?.paid_amount || 0);
                  const total = Number(doc.total_ttc || 0);
                  const remaining = Math.max(0, total - paid);

                  return (
                    <Link
                      key={doc.id}
                      href={`/work-orders/${doc.work_order_id}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 p-3 hover:bg-zinc-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {doc.facture_number || "Facture"}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {doc.work_orders?.clients?.full_name || "-"} ·{" "}
                          {daysSince(doc.created_at)} дн.
                        </p>
                      </div>
                      <p className="shrink-0 font-bold text-orange-400">
                        {money(remaining)}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  Неоплаченных фактур нет.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-red-400">Критичный склад</h2>
              <Link
                href="/inventory"
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Открыть склад
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {lowStockItems.length ? (
                lowStockItems.map((item: any) => (
                  <Link
                    key={item.id}
                    href="/inventory"
                    className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 p-3 hover:bg-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {item.part_number || "-"} · {item.location || "-"}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-red-400">
                      {Number(item.quantity || 0)} шт.
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-zinc-500">
                  Критичных остатков нет.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-bold text-green-400">Выручка</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Сегодня</p>
              <p className="mt-2 text-xl font-bold text-green-400">
                {money(todayRevenue)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Месяц</p>
              <p className="mt-2 text-xl font-bold">{money(monthRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-blue-400">Последние документы</h2>
            <div className="flex gap-3 text-xs">
              <Link href="/devis" className="text-zinc-500 hover:text-blue-400">
                Devis
              </Link>
              <Link
                href="/factures"
                className="text-zinc-500 hover:text-blue-400"
              >
                Factures
              </Link>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {recentDocuments.length ? (
              recentDocuments.map((doc: any) => (
                <Link
                  key={`${doc.kind}-${doc.id}`}
                  href={doc.kind === "devis" ? "/devis" : "/factures"}
                  className="flex items-center justify-between rounded-lg bg-zinc-950 p-3 hover:bg-zinc-800"
                >
                  <div>
                    <p className="text-sm font-bold text-blue-400">
                      {doc.number || "-"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {doc.work_orders?.clients?.full_name || "-"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {money(doc.total_ttc)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Документов пока нет.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-yellow-400">Рекомендации</h2>
            <Link
              href="/vehicles"
              className="text-xs text-zinc-500 hover:text-yellow-400"
            >
              Автомобили
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {recommendations.length ? (
              recommendations.map((recommendation: any) => (
                <Link
                  key={recommendation.id}
                  href={`/vehicles/${recommendation.vehicles?.id}`}
                  className="block rounded-lg bg-zinc-950 p-3 hover:bg-zinc-800"
                >
                  <p className="truncate text-sm font-semibold text-yellow-400">
                    {recommendation.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {recommendation.vehicles
                      ? `${recommendation.vehicles.brand} ${recommendation.vehicles.model} ${recommendation.vehicles.plate || ""}`
                      : "Автомобиль не указан"}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-500">
                Открытых рекомендаций нет.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}