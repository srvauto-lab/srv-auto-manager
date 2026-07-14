"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Supplier = {
  id: string;
  created_at: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
};

const emptyForm = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  notes: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadSuppliers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) alert(error.message);
    else setSuppliers(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      website: supplier.website || "",
      notes: supplier.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: form.name,
      contact_name: form.contact_name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      website: form.website,
      notes: form.notes,
    };

    const { error } = editingId
      ? await supabase.from("suppliers").update(payload).eq("id", editingId)
      : await supabase.from("suppliers").insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    await loadSuppliers();
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Удалить поставщика?")) return;

    const { error } = await supabase.from("suppliers").delete().eq("id", id);

    if (error) alert(error.message);
    else await loadSuppliers();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.website,
        supplier.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [suppliers, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Поставщики</h1>
      <p className="mt-2 text-zinc-400">База поставщиков SRV AUTO</p>

      <form
        onSubmit={saveSupplier}
        className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h2 className="text-xl font-bold text-green-400">
          {editingId ? "Редактировать поставщика" : "Добавить поставщика"}
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Название *"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Контактное лицо"
            value={form.contact_name}
            onChange={(e) => updateField("contact_name", e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Телефон"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Сайт"
            value={form.website}
            onChange={(e) => updateField("website", e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="Адрес"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3 md:col-span-3"
            placeholder="Комментарий"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded bg-green-500 px-5 py-3 font-bold text-black">
            {editingId ? "Сохранить изменения" : "Добавить поставщика"}
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
        placeholder="Поиск по поставщикам..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1200px] grid-cols-8 border-b border-zinc-800 p-4 font-bold text-zinc-400">
          <div>Название</div>
          <div>Контакт</div>
          <div>Телефон</div>
          <div>Email</div>
          <div>Сайт</div>
          <div>Адрес</div>
          <div>Комментарий</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filtered.length ? (
          filtered.map((supplier) => (
            <div
              key={supplier.id}
              className="grid min-w-[1200px] grid-cols-8 border-b border-zinc-800 p-4 text-sm"
            >
              <div className="font-bold text-green-400">
                {supplier.name}
              </div>
              <div>{supplier.contact_name || "-"}</div>
              <div>{supplier.phone || "-"}</div>
              <div>{supplier.email || "-"}</div>
              <div>{supplier.website || "-"}</div>
              <div>{supplier.address || "-"}</div>
              <div>{supplier.notes || "-"}</div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(supplier)}
                  className="rounded bg-blue-600 px-3 py-2 text-xs font-bold"
                >
                  Изменить
                </button>

                <button
                  type="button"
                  onClick={() => deleteSupplier(supplier.id)}
                  className="rounded bg-red-600 px-3 py-2 text-xs font-bold"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Поставщиков пока нет.</div>
        )}
      </div>
    </main>
  );
}