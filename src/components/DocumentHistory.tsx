"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { addHistory } from "@/lib/addHistory";

type Props = {
  workOrderId: string;
  devisList: any[];
  factureList: any[];
};

type DocumentType = "devis" | "facture";
type TableName = "devis" | "factures";

type StatusOption = {
  value: string;
  label: string;
  className: string;
};

const devisStatuses: StatusOption[] = [
  {
    value: "draft",
    label: "Черновик",
    className: "bg-zinc-700 text-white",
  },
  {
    value: "sent",
    label: "Отправлен",
    className: "bg-blue-600 text-white",
  },
  {
    value: "accepted",
    label: "Принят",
    className: "bg-green-500 text-black",
  },
  {
    value: "rejected",
    label: "Отклонён",
    className: "bg-red-600 text-white",
  },
  {
    value: "cancelled",
    label: "Отменён",
    className: "bg-zinc-900 text-zinc-300 border border-zinc-700",
  },
];

const factureStatuses: StatusOption[] = [
  {
    value: "draft",
    label: "Черновик",
    className: "bg-zinc-700 text-white",
  },
  {
    value: "sent",
    label: "Отправлена",
    className: "bg-blue-600 text-white",
  },
  {
    value: "partially_paid",
    label: "Частично оплачена",
    className: "bg-yellow-500 text-black",
  },
  {
    value: "paid",
    label: "Оплачена",
    className: "bg-green-500 text-black",
  },
  {
    value: "cancelled",
    label: "Отменена",
    className: "bg-red-700 text-white",
  },
];

function getStatusOptions(type: DocumentType) {
  return type === "devis" ? devisStatuses : factureStatuses;
}

function getStatusOption(type: DocumentType, status: string | null) {
  const options = getStatusOptions(type);

  return (
    options.find((option) => option.value === status) ||
    options.find((option) => option.value === "draft")!
  );
}

function getDocumentLabel(type: DocumentType) {
  return type === "devis" ? "Devis" : "Facture";
}

export default function DocumentHistory({
  workOrderId,
  devisList,
  factureList,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateStatus(
    table: TableName,
    type: DocumentType,
    doc: any,
    nextStatus: string
  ) {
    if (busyId || doc.status === nextStatus) return;

    const previousStatus = getStatusOption(type, doc.status);
    const newStatus = getStatusOption(type, nextStatus);
    const number =
      type === "devis" ? doc.devis_number : doc.facture_number;

    setBusyId(doc.id);

    try {
      const { error } = await supabase
        .from(table)
        .update({ status: nextStatus })
        .eq("id", doc.id);

      if (error) throw error;

      await addHistory({
        workOrderId,
        action: `Изменён статус ${getDocumentLabel(type)}`,
        description: `${number || "-"} · ${previousStatus.label} → ${newStatus.label}`,
        color:
          nextStatus === "paid" || nextStatus === "accepted"
            ? "green"
            : nextStatus === "cancelled" || nextStatus === "rejected"
            ? "red"
            : nextStatus === "sent"
            ? "blue"
            : "yellow",
      });

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Не удалось изменить статус документа.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDocument(
    table: TableName,
    type: DocumentType,
    doc: any
  ) {
    const number =
      type === "devis" ? doc.devis_number : doc.facture_number;

    if (!confirm(`Удалить ${getDocumentLabel(type)} ${number || ""}?`)) return;

    setBusyId(doc.id);

    try {
      const { error } = await supabase.from(table).delete().eq("id", doc.id);

      if (error) throw error;

      await addHistory({
        workOrderId,
        action: `Удалён ${getDocumentLabel(type)}`,
        description: number || "-",
        color: "red",
      });

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Не удалось удалить документ.");
    } finally {
      setBusyId(null);
    }
  }

  function DocumentRow({
    doc,
    type,
  }: {
    doc: any;
    type: DocumentType;
  }) {
    const table: TableName = type === "devis" ? "devis" : "factures";
    const number =
      type === "devis" ? doc.devis_number : doc.facture_number;
    const statusOptions = getStatusOptions(type);
    const currentStatus = getStatusOption(type, doc.status);
    const isBusy = busyId === doc.id;

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold text-green-400">{number || "-"}</p>

            <p className="mt-1 text-sm text-zinc-400">
              {doc.seller || "-"} · {String(doc.lang || "-").toUpperCase()} ·{" "}
              {Number(doc.total_ttc || 0).toFixed(2)} €
            </p>

            <div className="mt-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${currentStatus.className}`}
              >
                {currentStatus.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`rounded-lg px-3 py-2 text-sm font-bold outline-none ${currentStatus.className}`}
              value={currentStatus.value}
              disabled={isBusy}
              onChange={(event) =>
                updateStatus(table, type, doc, event.target.value)
              }
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-zinc-900 text-white"
                >
                  {option.label}
                </option>
              ))}
            </select>

            <Link
              href={`/work-orders/${workOrderId}/documents/${type}/${doc.lang}?seller=${doc.seller}&documentId=${doc.id}`}
              target="_blank"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500"
            >
              Открыть
            </Link>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => deleteDocument(table, type, doc)}
              className="rounded bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500 disabled:opacity-50"
            >
              {isBusy ? "Сохраняем..." : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">
        Созданные документы
      </h2>

      <div className="mt-5">
        <h3 className="font-bold text-zinc-300">Devis</h3>

        {devisList?.length ? (
          <div className="mt-3 space-y-3">
            {devisList.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} type="devis" />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Devis пока нет.</p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="font-bold text-zinc-300">Factures</h3>

        {factureList?.length ? (
          <div className="mt-3 space-y-3">
            {factureList.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} type="facture" />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Factures пока нет.</p>
        )}
      </div>
    </div>
  );
}