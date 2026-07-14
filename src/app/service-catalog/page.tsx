"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ServiceItem = {
  id: string;
  name: string;
  category: string | null;
  default_price: number | null;
  labor_hours: number | null;
  description: string | null;
  recommended_parts: string | null;
  is_active: boolean | null;
};

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [description, setDescription] = useState("");
  const [recommendedParts, setRecommendedParts] = useState("");

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_catalog")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setItems(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.name,
        item.category,
        item.description,
        item.recommended_parts,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    );
  }, [items, search]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("service_catalog").insert({
      name,
      category,
      default_price: Number(defaultPrice || 0),
      labor_hours: Number(laborHours || 0),
      description,
      recommended_parts: recommendedParts,
      is_active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setCategory("");
    setDefaultPrice("");
    setLaborHours("");
    setDescription("");
    setRecommendedParts("");

    await loadItems();
  }

  async function deleteItem(id: string) {
    if (!confirm("Удалить работу из каталога?")) return;

    const { error } = await supabase
      .from("service_catalog")
      .delete()
      .eq("id", id);

    if (error) alert(error.message);
    else await loadItems();
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Каталог работ</h1>
      <p className="mt-2 text-zinc-400">
        Типовые работы, цены и нормо-часы SRV AUTO
      </p>

      <form
        onSubmit={addItem}
        className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h2 className="text-xl font-bold text-green-400">Добавить работу</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <input
            className="rounded-lg bg-zinc-950 p-3"
            placeholder="Название работы *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            className="rounded-lg bg-zinc-950 p-3"
            placeholder="Категория"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <input
            className="rounded-lg bg-zinc-950 p-3"
            placeholder="Цена €"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
          />

          <input
            className="rounded-lg bg-zinc-950 p-3"
            placeholder="Нормо-часы"
            value={laborHours}
            onChange={(e) => setLaborHours(e.target.value)}
          />
        </div>

        <textarea
          className="mt-4 w-full rounded-lg bg-zinc-950 p-3"
          placeholder="Описание работы"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <textarea
          className="mt-4 w-full rounded-lg bg-zinc-950 p-3"
          placeholder="Рекомендуемые запчасти"
          value={recommendedParts}
          onChange={(e) => setRecommendedParts(e.target.value)}
        />

        <button
          type="submit"
          className="mt-4 rounded-lg bg-green-500 px-5 py-3 font-bold text-black"
        >
          Сохранить в каталог
        </button>
      </form>

      <input
        className="mt-8 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-3"
        placeholder="Поиск по каталогу..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">
        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filteredItems.length ? (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="border-b border-zinc-800 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-green-400">
                    {item.name}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {item.category || "Без категории"} ·{" "}
                    {item.default_price || 0} € ·{" "}
                    {item.labor_hours || 0} ч
                  </p>

                  {item.description && (
                    <p className="mt-3 text-zinc-300">{item.description}</p>
                  )}

                  {item.recommended_parts && (
                    <p className="mt-3 text-sm text-zinc-400">
                      Запчасти: {item.recommended_parts}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-bold"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Каталог пока пуст.</div>
        )}
      </div>
    </main>
  );
}