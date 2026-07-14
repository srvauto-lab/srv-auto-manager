"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import RequirePermission from "@/components/RequirePermission";
import { supabase } from "@/lib/supabase";

type AuditRow = {
  id: number;
  created_at: string;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const actionLabels: Record<string, string> = {
  insert: "Создание",
  update: "Изменение",
  delete: "Удаление",
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [table, setTable] = useState("");

  async function load() {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("id, created_at, user_name, action, table_name, record_id, old_data, new_data")
      .order("created_at", { ascending: false })
      .limit(500);

    if (table) query = query.eq("table_name", table);
    const { data, error } = await query;
    if (error) alert(error.message);
    else setRows((data || []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [table]);

  const tableOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.table_name))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.user_name, row.action, row.table_name, row.record_id, JSON.stringify(row.new_data), JSON.stringify(row.old_data)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <RequirePermission permission="audit.view">
      <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-green-400">
            <History size={28} /> Журнал действий
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Кто, когда и какие данные создавал, изменял или удалял
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пользователь, таблица, ID, данные..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-green-500"
            />
          </label>
          <select
            value={table}
            onChange={(event) => setTable(event.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          >
            <option value="">Все модули</option>
            {tableOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-zinc-400">Загрузка...</p>
          ) : filtered.length ? (
            filtered.map((row) => (
              <article key={row.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-green-400">{row.user_name || "Система"}</span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs">
                      {actionLabels[row.action] || row.action}
                    </span>
                    <span className="text-sm text-zinc-400">{row.table_name}</span>
                  </div>
                  <time className="text-xs text-zinc-600">
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </time>
                </div>
                <p className="mt-2 break-all text-xs text-zinc-600">ID: {row.record_id || "-"}</p>
                {row.action === "update" && (
                  <details className="mt-3 rounded-lg bg-zinc-950 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
                      Показать изменения
                    </summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <pre className="overflow-auto whitespace-pre-wrap break-words text-xs text-red-300">
                        {JSON.stringify(row.old_data, null, 2)}
                      </pre>
                      <pre className="overflow-auto whitespace-pre-wrap break-words text-xs text-green-300">
                        {JSON.stringify(row.new_data, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
              Записей не найдено.
            </p>
          )}
        </div>
      </main>
    </RequirePermission>
  );
}
