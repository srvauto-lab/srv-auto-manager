import Link from "next/link";
import { supabase } from "@/lib/supabase";
import VehicleRecommendations from "@/components/VehicleRecommendations";

type PageProps = {
  params: Promise<{ id: string }>;
};

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function mileage(value: unknown) {
  const number = Number(String(value ?? "").replace(/\s/g, ""));

  return Number.isFinite(number) && number > 0
    ? `${number.toLocaleString("ru-RU")} км`
    : "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [
    vehicleResult,
    ordersResult,
    recommendationsResult,
    mileageHistoryResult,
    photosResult,
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        "*, clients(id, full_name, phone, email, company_name, client_type)"
      )
      .eq("id", id)
      .single(),

    supabase
      .from("work_orders")
      .select(
        "id, order_number, created_at, status, mileage, total_amount, paid_amount, payment_status, customer_complaint, notes"
      )
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("vehicle_recommendations")
      .select("*")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("vehicle_mileage_history")
      .select(
        "id, mileage, source, note, recorded_at, work_order_id, work_orders(order_number)"
      )
      .eq("vehicle_id", id)
      .order("recorded_at", { ascending: false }),

    supabase
      .from("work_order_photos")
      .select(
        "id, work_order_id, created_at, category, label, public_url, photo_url, url, image_url"
      )
      .order("created_at", { ascending: false }),
  ]);

  const vehicle = vehicleResult.data;

  if (vehicleResult.error || !vehicle) {
    return (
      <main className="p-8 text-white">
        <h1 className="text-3xl font-bold text-red-400">
          Автомобиль не найден
        </h1>
      </main>
    );
  }

  const orders = ordersResult.data || [];
  const recommendations = recommendationsResult.data || [];
  const mileageHistory = mileageHistoryResult.data || [];

  const orderIds = orders.map((order: any) => order.id);

  const [devisResult, facturesResult, paymentsResult] = orderIds.length
    ? await Promise.all([
        supabase
          .from("devis")
          .select(
            "id, devis_number, work_order_id, created_at, status, total_ttc, seller, lang"
          )
          .in("work_order_id", orderIds)
          .order("created_at", { ascending: false }),

        supabase
          .from("factures")
          .select(
            "id, facture_number, work_order_id, created_at, status, total_ttc, seller, lang"
          )
          .in("work_order_id", orderIds)
          .order("created_at", { ascending: false }),

        supabase
          .from("work_order_payments")
          .select(
            "id, work_order_id, amount, payment_method, payment_date, note"
          )
          .in("work_order_id", orderIds)
          .order("payment_date", { ascending: false }),
      ])
    : [
        { data: [] as any[], error: null },
        { data: [] as any[], error: null },
        { data: [] as any[], error: null },
      ];

  const devis = devisResult.data || [];
  const factures = facturesResult.data || [];
  const payments = paymentsResult.data || [];

  const photos = (photosResult.data || []).filter((photo: any) =>
    orderIds.includes(photo.work_order_id)
  );

  const ownerName =
    vehicle.clients?.client_type === "societe"
      ? vehicle.clients?.company_name || vehicle.clients?.full_name
      : vehicle.clients?.full_name;

  const totalOrdersValue = orders.reduce(
    (sum: number, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  const totalPaid = payments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const totalRemaining = Math.max(0, totalOrdersValue - totalPaid);

  const currentMileage =
    Number(vehicle.mileage || 0) ||
    Number(mileageHistory[0]?.mileage || 0) ||
    Number(orders[0]?.mileage || 0);

  const lastVisit = orders[0]?.created_at || null;
  const openRecommendations = recommendations.filter(
    (item: any) => item.status === "open"
  );

  const timeline = [
    ...orders.map((order: any) => ({
      id: `order-${order.id}`,
      date: order.created_at,
      type: "order",
      title: order.order_number || "Заказ-наряд",
      subtitle: `${order.status || "-"} · ${mileage(order.mileage)}`,
      amount: Number(order.total_amount || 0),
      href: `/work-orders/${order.id}`,
    })),
    ...devis.map((doc: any) => ({
      id: `devis-${doc.id}`,
      date: doc.created_at,
      type: "devis",
      title: doc.devis_number || "Devis",
      subtitle: doc.status || "draft",
      amount: Number(doc.total_ttc || 0),
      href: `/work-orders/${doc.work_order_id}/documents/devis/${
        doc.lang || "fr"
      }?seller=${doc.seller || "srvauto"}&documentId=${doc.id}`,
    })),
    ...factures.map((doc: any) => ({
      id: `facture-${doc.id}`,
      date: doc.created_at,
      type: "facture",
      title: doc.facture_number || "Facture",
      subtitle: doc.status || "draft",
      amount: Number(doc.total_ttc || 0),
      href: `/work-orders/${doc.work_order_id}/documents/facture/${
        doc.lang || "fr"
      }?seller=${doc.seller || "srvauto"}&documentId=${doc.id}`,
    })),
    ...payments.map((payment: any) => ({
      id: `payment-${payment.id}`,
      date: payment.payment_date,
      type: "payment",
      title: "Оплата",
      subtitle: `${payment.payment_method || "-"}${
        payment.note ? ` · ${payment.note}` : ""
      }`,
      amount: Number(payment.amount || 0),
      href: `/work-orders/${payment.work_order_id}`,
    })),
  ].sort(
    (a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <Link
        href="/vehicles"
        className="text-sm text-zinc-400 hover:text-green-400"
      >
        ← Назад к автомобилям
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">
            {vehicle.brand} {vehicle.model}
          </h1>

          <p className="mt-2 text-zinc-400">
            {vehicle.plate || "Без номера"} · VIN: {vehicle.vin || "-"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/work-orders/new?vehicleId=${vehicle.id}&clientId=${
              vehicle.clients?.id || ""
            }`}
            className="rounded bg-green-500 px-4 py-3 font-bold text-black hover:bg-green-400"
          >
            + Новый заказ
          </Link>

          <Link
            href={`/vehicles/${vehicle.id}/edit`}
            className="rounded bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500"
          >
            Изменить автомобиль
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          title="Текущий пробег"
          value={mileage(currentMileage)}
          accent="text-green-400"
        />

        <MetricCard
          title="Визитов"
          value={String(orders.length)}
          accent="text-blue-400"
        />

        <MetricCard
          title="Всего работ"
          value={money(totalOrdersValue)}
          accent="text-white"
        />

        <MetricCard
          title="Оплачено"
          value={money(totalPaid)}
          accent="text-green-400"
        />

        <MetricCard
          title="Осталось"
          value={money(totalRemaining)}
          accent="text-orange-400"
        />

        <MetricCard
          title="Рекомендаций"
          value={String(openRecommendations.length)}
          accent="text-yellow-400"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold text-green-400">
              История автомобиля
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Заказы, Devis, Factures и оплаты в одной ленте
            </p>

            {timeline.length ? (
              <div className="mt-5 space-y-3">
                {timeline.map((item: any) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    target={
                      item.type === "devis" || item.type === "facture"
                        ? "_blank"
                        : undefined
                    }
                    className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 hover:border-green-500 md:grid-cols-[110px_110px_1fr_120px]"
                  >
                    <p className="text-sm text-zinc-500">
                      {formatDate(item.date)}
                    </p>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                        item.type === "order"
                          ? "bg-green-600 text-white"
                          : item.type === "devis"
                          ? "bg-blue-600 text-white"
                          : item.type === "facture"
                          ? "bg-purple-600 text-white"
                          : "bg-yellow-500 text-black"
                      }`}
                    >
                      {item.type === "order"
                        ? "Заказ"
                        : item.type === "devis"
                        ? "Devis"
                        : item.type === "facture"
                        ? "Facture"
                        : "Оплата"}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.title}</p>
                      <p className="truncate text-sm text-zinc-400">
                        {item.subtitle}
                      </p>
                    </div>

                    <p
                      className={`text-right font-bold ${
                        item.type === "payment"
                          ? "text-green-400"
                          : "text-white"
                      }`}
                    >
                      {money(item.amount)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-zinc-500">
                История по автомобилю пока пустая.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold text-blue-400">
              История пробега
            </h2>

            {mileageHistory.length ? (
              <div className="mt-5 space-y-3">
                {mileageHistory.map((entry: any, index: number) => {
                  const previous = mileageHistory[index + 1];
                  const difference = previous
                    ? Number(entry.mileage || 0) -
                      Number(previous.mileage || 0)
                    : null;

                  return (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-lg bg-zinc-950 p-4 md:grid-cols-[130px_150px_1fr]"
                    >
                      <p className="text-sm text-zinc-500">
                        {formatDateTime(entry.recorded_at)}
                      </p>

                      <div>
                        <p className="font-bold text-blue-400">
                          {mileage(entry.mileage)}
                        </p>

                        {difference !== null && (
                          <p
                            className={`text-xs ${
                              difference < 0
                                ? "text-red-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {difference >= 0 ? "+" : ""}
                            {difference.toLocaleString("ru-RU")} км
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm">
                          {entry.work_orders?.order_number ||
                            (entry.source === "manual"
                              ? "Ручное изменение"
                              : "Заказ-наряд")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {entry.note || entry.source || "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-zinc-500">
                История пробега появится после сохранения заказ-наряда.
              </p>
            )}
          </div>

          <VehicleRecommendations
            vehicleId={id}
            recommendations={recommendations}
          />
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold">Данные автомобиля</h2>

            <div className="mt-4 space-y-2 text-sm">
              <InfoRow label="Марка" value={vehicle.brand} />
              <InfoRow label="Модель" value={vehicle.model} />
              <InfoRow label="Год" value={vehicle.year} />
              <InfoRow label="Двигатель" value={vehicle.engine} />
              <InfoRow label="Топливо" value={vehicle.fuel} />
              <InfoRow label="КПП" value={vehicle.gearbox} />
              <InfoRow label="Цвет" value={vehicle.color} />
              <InfoRow label="Госномер" value={vehicle.plate} />
              <InfoRow label="VIN" value={vehicle.vin} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold">Владелец</h2>

            <div className="mt-4 space-y-2 text-sm">
              <InfoRow label="Клиент" value={ownerName} />
              <InfoRow label="Телефон" value={vehicle.clients?.phone} />
              <InfoRow label="Email" value={vehicle.clients?.email} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold text-purple-400">
              Документы и файлы
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Counter label="Devis" value={devis.length} />
              <Counter label="Factures" value={factures.length} />
              <Counter label="Оплаты" value={payments.length} />
              <Counter label="Фото" value={photos.length} />
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Последний визит: {formatDate(lastVisit)}
            </p>
          </div>

          {vehicle.notes && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-bold">Примечания</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
                {vehicle.notes}
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function MetricCard({
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-800 py-2 last:border-b-0">
      <span className="text-zinc-500">{label}</span>
      <b className="max-w-[65%] break-words text-right">
        {String(value || "-")}
      </b>
    </div>
  );
}

function Counter({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-zinc-950 p-4 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-purple-400">{value}</p>
    </div>
  );
}