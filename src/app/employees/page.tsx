"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  active: boolean | null;
  notes: string | null;
};

const emptyForm = {
  full_name: "",
  role: "mechanic",
  phone: "",
  email: "",
  active: true,
  notes: "",
};

const roles = [
  ["admin", "Администратор"],
  ["mechanic", "Механик"],
  ["reception", "Приёмщик"],
  ["accountant", "Бухгалтер"],
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("full_name");

    if (error) alert(error.message);
    else setEmployees(data || []);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      full_name: employee.full_name || "",
      role: employee.role || "mechanic",
      phone: employee.phone || "",
      email: employee.email || "",
      active: employee.active ?? true,
      notes: employee.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();

    const { error } = editingId
      ? await supabase.from("employees").update(form).eq("id", editingId)
      : await supabase.from("employees").insert(form);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    await loadEmployees();
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Удалить сотрудника?")) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) alert(error.message);
    else await loadEmployees();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return employees.filter((e) =>
      [e.full_name, e.role, e.phone, e.email, e.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Сотрудники</h1>
      <p className="mt-2 text-zinc-400">Команда SRV AUTO</p>

      <form
        onSubmit={saveEmployee}
        className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h2 className="text-xl font-bold text-green-400">
          {editingId ? "Редактировать сотрудника" : "Добавить сотрудника"}
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="ФИО *"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />

          <select
            className="rounded bg-zinc-950 p-3"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Телефон"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <select
            className="rounded bg-zinc-950 p-3"
            value={form.active ? "active" : "inactive"}
            onChange={(e) =>
              setForm({ ...form, active: e.target.value === "active" })
            }
          >
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Комментарий"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded bg-green-500 px-5 py-3 font-bold text-black">
            {editingId ? "Сохранить изменения" : "Добавить сотрудника"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-zinc-700 px-5 py-3"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      <input
        className="mt-8 w-full rounded bg-zinc-900 p-3"
        placeholder="Поиск по сотрудникам..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1000px] grid-cols-7 border-b border-zinc-800 p-4 font-bold text-zinc-400">
          <div>ФИО</div>
          <div>Роль</div>
          <div>Телефон</div>
          <div>Email</div>
          <div>Статус</div>
          <div>Комментарий</div>
          <div>Действия</div>
        </div>

        {filtered.length ? (
          filtered.map((employee) => (
            <div
              key={employee.id}
              className="grid min-w-[1000px] grid-cols-7 border-b border-zinc-800 p-4 text-sm"
            >
              <div className="font-bold text-green-400">
                {employee.full_name}
              </div>
              <div>{employee.role || "-"}</div>
              <div>{employee.phone || "-"}</div>
              <div>{employee.email || "-"}</div>
              <div>{employee.active ? "Активен" : "Неактивен"}</div>
              <div>{employee.notes || "-"}</div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startEdit(employee)}
                  className="rounded bg-blue-600 px-3 py-2 text-xs font-bold"
                >
                  Изменить
                </button>

                <button
                  onClick={() => deleteEmployee(employee.id)}
                  className="rounded bg-red-600 px-3 py-2 text-xs font-bold"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Сотрудников пока нет.</div>
        )}
      </div>
    </main>
  );
}