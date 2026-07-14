"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  chief_mechanic: "Главный механик",
  reception: "Приёмщик",
  mechanic: "Механик",
  accountant: "Бухгалтер",
  warehouse: "Склад",
};

type Employee = {
  id: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  email: string;
  is_active: boolean;
  last_sign_in_at: string | null;
};

export default function EmployeesPage() {
  const { can } = usePermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/employees", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Ошибка загрузки сотрудников.");
      else setEmployees(data.employees || []);
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      [employee.full_name, employee.email, employee.phone, roleLabels[employee.role]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [employees, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-green-400">Сотрудники</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Единый справочник из аккаунтов и профилей CRM
          </p>
        </div>

        {can("access.manage") && (
          <Link
            href="/access"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-black"
          >
            <ShieldCheck size={18} /> Управлять доступом
          </Link>
        )}
      </div>

      <label className="relative mt-6 block max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Имя, роль, телефон или email..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-green-500"
        />
      </label>

      {loading ? (
        <p className="mt-8 text-zinc-400">Загрузка...</p>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((employee) => (
            <article key={employee.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-green-400">
                  <UserRound size={19} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{employee.full_name || "Без имени"}</p>
                  <p className="truncate text-sm text-zinc-500">{employee.email || "-"}</p>
                  <p className="mt-2 text-sm text-green-400">{roleLabels[employee.role] || employee.role}</p>
                  <p className="mt-1 text-sm text-zinc-400">{employee.phone || "Телефон не указан"}</p>
                  <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${employee.is_active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {employee.is_active ? "Активен" : "Отключён"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
