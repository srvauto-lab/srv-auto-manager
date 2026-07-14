import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const statusMap: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Черновик",
    className: "bg-zinc-700 text-white",
  },
  sent: {
    label: "Отправлена",
    className: "bg-blue-600 text-white",
  },
  partially_paid: {
    label: "Частично оплачена",
    className: "bg-yellow-500 text-black",
  },
  paid: {
    label: "Оплачена",
    className: "bg-green-500 text-black",
  },
  cancelled: {
    label: "Отменена",
    className: "bg-red-700 text-white",
  },
};

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default async function FacturesPage() {
  const supabase = await createClient();
  const { data: factures, error } = await supabase
    .from("factures")
    .select(`
      *,
      work_orders(
        id,
        order_number,
        total_amount,
        paid_amount,
        payment_status,
        clients(full_name, phone),
        vehicles(brand, model, plate, vin)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold text-green-400">Factures</h1>
        <p className="mt-6 rounded-lg bg-red-950/40 p-4 text-red-300">
          {error.message}
        </p>
      </main>
    );
  }

  const rows = factures || [];

  const totalTtc = rows.reduce(
    (sum: number, doc: any) => sum + Number(doc.total_ttc || 0),
    0
  );

  const totalPaid = rows.reduce(
    (sum: number, doc: any) =>
      sum + Number(doc.work_orders?.paid_amount || 0),
    0
  );

  const totalRemaining = Math.max(0, totalTtc - totalPaid);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div>
        <h1 className="text-3xl font-bold text-green-400">Factures</h1>
        <p className="mt-2 text-zinc-400">
          Реестр всех фактур SRV AUTO
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Всего фактур</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {rows.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Общая сумма</p>
          <p className="mt-2 text-3xl font-bold">
            {money(totalTtc)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Оплачено</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {money(totalPaid)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Осталось получить</p>
          <p className="mt-2 text-3xl font-bold text-orange-400">
            {money(totalRemaining)}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1500px] grid-cols-9 border-b border-zinc-800 p-4 text-sm font-semibold text-zinc-400">
          <div>№ Facture</div>
          <div>Клиент</div>
          <div>Автомобиль</div>
          <div>Заказ-наряд</div>
          <div>Сумма TTC</div>
          <div>Оплачено</div>
          <div>Осталось</div>
          <div>Статус</div>
          <div>Действия</div>
        </div>

        {rows.length ? (
          rows.map((doc: any) => {
            const paid = Number(doc.work_orders?.paid_amount || 0);
            const total = Number(doc.total_ttc || 0);
            const remaining = Math.max(0, total - paid);
            const status =
              statusMap[doc.status] ||
              statusMap[
                remaining <= 0 && total > 0
                  ? "paid"
                  : paid > 0
                  ? "partially_paid"
                  : "draft"
              ];

            return (
              <div
                key={doc.id}
                className="grid min-w-[1500px] grid-cols-9 items-center border-b border-zinc-800 p-4 text-sm"
              >
                <div className="font-bold text-green-400">
                  {doc.facture_number || "-"}
                </div>

                <div>
                  <p>{doc.work_orders?.clients?.full_name || "-"}</p>
                  <p className="text-xs text-zinc-500">
                    {doc.work_orders?.clients?.phone || ""}
                  </p>
                </div>

                <div>
                  <p>
                    {doc.work_orders?.vehicles?.brand || "-"}{" "}
                    {doc.work_orders?.vehicles?.model || ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {doc.work_orders?.vehicles?.plate || "-"}
                  </p>
                </div>

                <div className="text-zinc-300">
                  {doc.work_orders?.order_number || "-"}
                </div>

                <div className="font-semibold">{money(total)}</div>

                <div className="font-semibold text-green-400">
                  {money(paid)}
                </div>

                <div
                  className={
                    remaining > 0
                      ? "font-semibold text-orange-400"
                      : "font-semibold text-green-400"
                  }
                >
                  {money(remaining)}
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    target="_blank"
                    href={`/work-orders/${doc.work_order_id}/documents/facture/${doc.lang}?seller=${doc.seller}&documentId=${doc.id}`}
                    className="rounded bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500"
                  >
                    PDF
                  </Link>

                  <Link
                    href={`/work-orders/${doc.work_order_id}`}
                    className="rounded bg-zinc-700 px-3 py-2 text-xs font-bold hover:bg-zinc-600"
                  >
                    Заказ
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-zinc-500">
            Пока нет ни одной фактуры.
          </div>
        )}
      </div>
    </main>
  );
}
