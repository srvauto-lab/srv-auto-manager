"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addHistory } from "@/lib/addHistory";

type StatusConfig = {
  label: string;
  className: string;
};

type DevisRow = {
  id: string;
  devis_number: string | null;
  work_order_id: string;
  seller: string | null;
  lang: string | null;
  total_ht: number | null;
  tva_amount: number | null;
  total_ttc: number | null;
  status: string | null;
  source_lang: string | null;
  translated_payload: any;
  translated_at: string | null;
  created_at: string;
  converted_to_facture: boolean | null;
  facture_id: string | null;
  converted_at: string | null;
  work_orders?: {
    id: string;
    order_number: string | null;
    clients?: {
      full_name: string | null;
      phone?: string | null;
    } | null;
    vehicles?: {
      brand: string | null;
      model: string | null;
      plate: string | null;
      vin?: string | null;
    } | null;
  } | null;
};

const statusMap: Record<string, StatusConfig> = {
  draft: {
    label: "Черновик",
    className: "bg-zinc-700 text-white",
  },
  sent: {
    label: "Отправлен",
    className: "bg-blue-600 text-white",
  },
  accepted: {
    label: "Принят",
    className: "bg-green-500 text-black",
  },
  rejected: {
    label: "Отклонён",
    className: "bg-red-600 text-white",
  },
  cancelled: {
    label: "Отменён",
    className: "bg-zinc-900 text-zinc-300 border border-zinc-700",
  },
};

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function DevisPage() {
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadDevis() {
    setLoading(true);

    const { data, error } = await supabase
      .from("devis")
      .select(`
        *,
        work_orders(
          id,
          order_number,
          clients(full_name, phone),
          vehicles(brand, model, plate, vin)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setDevis((data || []) as DevisRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDevis();
  }, []);

  async function convertToFacture(doc: DevisRow) {
    if (busyId || doc.converted_to_facture || doc.facture_id) return;

    if (doc.status === "cancelled" || doc.status === "rejected") {
      alert("Нельзя создать Facture из отменённого или отклонённого Devis.");
      return;
    }

    if (
      !confirm(
        `Создать Facture из ${doc.devis_number || "этого Devis"}?`
      )
    ) {
      return;
    }

    setBusyId(doc.id);

    try {
      const facturePayload = {
        work_order_id: doc.work_order_id,
        devis_id: doc.id,
        seller: doc.seller || "srvauto",
        lang: doc.lang || "fr",
        total_ht: Number(doc.total_ht || 0),
        tva_amount: Number(doc.tva_amount || 0),
        total_ttc: Number(doc.total_ttc || 0),
        source_lang: doc.source_lang || "ru",
        translated_payload: doc.translated_payload || null,
        translated_at: doc.translated_at || null,
        status: "draft",
      };

      const { data: facture, error: factureError } = await supabase
        .from("factures")
        .insert(facturePayload)
        .select("id, facture_number")
        .single();

      if (factureError) throw factureError;

      const { error: devisError } = await supabase
        .from("devis")
        .update({
          converted_to_facture: true,
          facture_id: facture.id,
          converted_at: new Date().toISOString(),
          status: doc.status === "draft" ? "accepted" : doc.status,
        })
        .eq("id", doc.id);

      if (devisError) {
        await supabase.from("factures").delete().eq("id", facture.id);
        throw devisError;
      }

      await addHistory({
        workOrderId: doc.work_order_id,
        action: "Devis преобразован в Facture",
        description: `${doc.devis_number || "-"} → ${
          facture.facture_number || "-"
        }`,
        color: "blue",
      });

      await loadDevis();

      window.open(
        `/work-orders/${doc.work_order_id}/documents/facture/${
          doc.lang || "fr"
        }?seller=${doc.seller || "srvauto"}&documentId=${facture.id}`,
        "_blank"
      );
    } catch (error: any) {
      alert(error?.message || "Не удалось создать Facture.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return devis.filter((doc) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "converted"
          ? Boolean(doc.converted_to_facture || doc.facture_id)
          : doc.status === statusFilter);

      const searchableText = [
        doc.devis_number,
        doc.work_orders?.order_number,
        doc.work_orders?.clients?.full_name,
        doc.work_orders?.clients?.phone,
        doc.work_orders?.vehicles?.brand,
        doc.work_orders?.vehicles?.model,
        doc.work_orders?.vehicles?.plate,
        doc.work_orders?.vehicles?.vin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [devis, search, statusFilter]);

  const acceptedCount = devis.filter((doc) => doc.status === "accepted").length;
  const convertedCount = devis.filter(
    (doc) => doc.converted_to_facture || doc.facture_id
  ).length;
  const totalTtc = devis.reduce(
    (sum, doc) => sum + Number(doc.total_ttc || 0),
    0
  );

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div>
        <h1 className="text-3xl font-bold text-green-400">Devis</h1>
        <p className="mt-2 text-zinc-400">
          Реестр всех коммерческих предложений
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Всего Devis</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {devis.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Принято</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {acceptedCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Преобразовано в Facture</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">
            {convertedCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Общая сумма</p>
          <p className="mt-2 text-3xl font-bold">{money(totalTtc)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <input
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          placeholder="Поиск: Devis, клиент, автомобиль, VIN, заказ..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="sent">Отправлен</option>
          <option value="accepted">Принят</option>
          <option value="rejected">Отклонён</option>
          <option value="cancelled">Отменён</option>
          <option value="converted">Преобразован в Facture</option>
        </select>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1550px] grid-cols-8 border-b border-zinc-800 p-4 text-sm font-semibold text-zinc-400">
          <div>№ Devis</div>
          <div>Клиент</div>
          <div>Автомобиль</div>
          <div>Заказ-наряд</div>
          <div>Сумма TTC</div>
          <div>Статус</div>
          <div>Facture</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-8 text-zinc-400">Загрузка...</div>
        ) : filtered.length ? (
          filtered.map((doc) => {
            const status =
              statusMap[doc.status || "draft"] || statusMap.draft;
            const isConverted = Boolean(
              doc.converted_to_facture || doc.facture_id
            );
            const isBusy = busyId === doc.id;

            return (
              <div
                key={doc.id}
                className="grid min-w-[1550px] grid-cols-8 items-center border-b border-zinc-800 p-4 text-sm"
              >
                <div className="font-bold text-green-400">
                  {doc.devis_number || "-"}
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

                <div>{doc.work_orders?.order_number || "-"}</div>

                <div className="font-semibold">
                  {money(doc.total_ttc)}
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div>
                  {isConverted ? (
                    <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-bold">
                      Создана
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    target="_blank"
                    href={`/work-orders/${doc.work_order_id}/documents/devis/${
                      doc.lang || "fr"
                    }?seller=${doc.seller || "srvauto"}&documentId=${doc.id}`}
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

                  {!isConverted && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => convertToFacture(doc)}
                      className="rounded bg-green-600 px-3 py-2 text-xs font-bold hover:bg-green-500 disabled:opacity-50"
                    >
                      {isBusy ? "Создаём..." : "Создать Facture"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-zinc-500">
            Devis не найдено.
          </div>
        )}
      </div>
    </main>
  );
}