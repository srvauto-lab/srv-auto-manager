"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type InventoryItem = {
  id: string;
  part_number: string | null;
  manufacturer: string | null;
  name: string;
  purchase_price: number | null;
  sale_price: number | null;
  quantity: number | null;
  min_quantity: number | null;
  location: string | null;
  supplier: string | null;
  last_purchase_date: string | null;
  notes: string | null;
};

const emptyForm = {
  part_number: "",
  manufacturer: "",
  name: "",
  purchase_price: "",
  sale_price: "",
  quantity: "",
  min_quantity: "",
  location: "",
  supplier: "",
  last_purchase_date: "",
  notes: "",
};

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function markupPercent(purchase: number, sale: number) {
  if (purchase <= 0) return sale > 0 ? 100 : 0;
  return ((sale - purchase) / purchase) * 100;
}

function marginPercent(purchase: number, sale: number) {
  if (sale <= 0) return 0;
  return ((sale - purchase) / sale) * 100;
}

function marginClass(percent: number) {
  if (percent < 20) return "text-red-400";
  if (percent < 40) return "text-orange-400";
  return "text-green-400";
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("name", { ascending: true });

    if (error) alert(error.message);
    else setItems(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      part_number: item.part_number || "",
      manufacturer: item.manufacturer || "",
      name: item.name || "",
      purchase_price: String(item.purchase_price ?? ""),
      sale_price: String(item.sale_price ?? ""),
      quantity: String(item.quantity ?? ""),
      min_quantity: String(item.min_quantity ?? ""),
      location: item.location || "",
      supplier: item.supplier || "",
      last_purchase_date: item.last_purchase_date || "",
      notes: item.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicateItem(item: InventoryItem) {
    setEditingId(null);
    setForm({
      part_number: item.part_number || "",
      manufacturer: item.manufacturer || "",
      name: `${item.name} копия`,
      purchase_price: String(item.purchase_price ?? ""),
      sale_price: String(item.sale_price ?? ""),
      quantity: "0",
      min_quantity: String(item.min_quantity ?? ""),
      location: item.location || "",
      supplier: item.supplier || "",
      last_purchase_date: item.last_purchase_date || "",
      notes: item.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();

    const purchasePrice = Number(form.purchase_price || 0);
    const salePrice = Number(form.sale_price || 0);

    if (purchasePrice < 0 || salePrice < 0) {
      alert("Цена не может быть отрицательной.");
      return;
    }

    if (salePrice > 0 && salePrice < purchasePrice) {
      const confirmed = confirm(
        "Цена продажи ниже закупочной. Сохранить позицию с отрицательной маржой?"
      );

      if (!confirmed) return;
    }

    setSaving(true);

    const payload = {
      part_number: form.part_number.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      name: form.name.trim(),
      purchase_price: purchasePrice,
      sale_price: salePrice,
      quantity: Number(form.quantity || 0),
      min_quantity: Number(form.min_quantity || 0),
      location: form.location.trim() || null,
      supplier: form.supplier.trim() || null,
      last_purchase_date: form.last_purchase_date || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("inventory").update(payload).eq("id", editingId)
      : await supabase.from("inventory").insert(payload);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    await loadItems();
  }

  async function deleteItem(id: string) {
    if (!confirm("Удалить деталь?")) return;

    const { error } = await supabase.from("inventory").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadItems();
  }

  async function changeQuantity(item: InventoryItem, delta: number) {
    const next = Math.max(0, Number(item.quantity || 0) + delta);

    const { error } = await supabase
      .from("inventory")
      .update({ quantity: next })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadItems();
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return items.filter((item) =>
      [
        item.part_number,
        item.manufacturer,
        item.name,
        item.location,
        item.supplier,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  const lowStockCount = items.filter(
    (item) => Number(item.quantity || 0) <= Number(item.min_quantity || 0)
  ).length;

  const stockPurchaseValue = items.reduce(
    (sum, item) =>
      sum + Number(item.purchase_price || 0) * Number(item.quantity || 0),
    0
  );

  const stockSaleValue = items.reduce(
    (sum, item) =>
      sum + Number(item.sale_price || 0) * Number(item.quantity || 0),
    0
  );

  const formPurchase = Number(form.purchase_price || 0);
  const formSale = Number(form.sale_price || 0);
  const formProfit = formSale - formPurchase;
  const formMarkup = markupPercent(formPurchase, formSale);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <h1 className="text-3xl font-bold text-green-400">Склад SRV AUTO</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Запчасти, себестоимость, продажа и маржа
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Позиций" value={String(items.length)} accent="text-green-400" />
        <Metric title="Заканчивается" value={String(lowStockCount)} accent="text-red-400" />
        <Metric title="Закупочная стоимость" value={money(stockPurchaseValue)} accent="text-blue-400" />
        <Metric title="Продажная стоимость" value={money(stockSaleValue)} accent="text-white" />
        <Metric
          title="Потенциальная прибыль"
          value={money(stockSaleValue - stockPurchaseValue)}
          accent="text-green-400"
        />
      </section>

      <form
        onSubmit={saveItem}
        className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h2 className="text-xl font-bold text-green-400">
          {editingId ? "Редактировать деталь" : "Добавить деталь"}
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <input className="rounded bg-zinc-950 p-3" placeholder="Артикул" value={form.part_number} onChange={(e) => updateField("part_number", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Производитель" value={form.manufacturer} onChange={(e) => updateField("manufacturer", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Название *" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
          <input className="rounded bg-zinc-950 p-3" placeholder="Количество" type="number" min="0" value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Мин. остаток" type="number" min="0" value={form.min_quantity} onChange={(e) => updateField("min_quantity", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Закупка HT" type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => updateField("purchase_price", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Продажа HT" type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => updateField("sale_price", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Полка / место" value={form.location} onChange={(e) => updateField("location", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" placeholder="Поставщик" value={form.supplier} onChange={(e) => updateField("supplier", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3" type="date" value={form.last_purchase_date} onChange={(e) => updateField("last_purchase_date", e.target.value)} />
          <input className="rounded bg-zinc-950 p-3 md:col-span-2" placeholder="Примечание" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Preview label="Прибыль с 1 шт." value={money(formProfit)} className={formProfit >= 0 ? "text-green-400" : "text-red-400"} />
          <Preview label="Наценка" value={`${formMarkup.toFixed(1)} %`} className={marginClass(formMarkup)} />
          <Preview label="Маржа от продажи" value={`${marginPercent(formPurchase, formSale).toFixed(1)} %`} className={marginClass(marginPercent(formPurchase, formSale))} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button disabled={saving} className="rounded bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50">
            {saving ? "Сохраняем..." : editingId ? "Сохранить изменения" : "Добавить на склад"}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} className="rounded border border-zinc-700 px-5 py-3">
              Отмена
            </button>
          )}
        </div>
      </form>

      <input
        className="mt-6 w-full rounded bg-zinc-900 p-3"
        placeholder="Поиск: артикул, производитель, название, поставщик, полка..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1650px] grid-cols-13 border-b border-zinc-800 p-4 font-bold text-zinc-400">
          <div>Артикул</div>
          <div>Производитель</div>
          <div>Название</div>
          <div>Остаток</div>
          <div>Мин.</div>
          <div>Закупка</div>
          <div>Продажа</div>
          <div>Прибыль</div>
          <div>Наценка</div>
          <div>Маржа</div>
          <div>Полка</div>
          <div>Поставщик</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filtered.length ? (
          filtered.map((item) => {
            const quantity = Number(item.quantity || 0);
            const minQuantity = Number(item.min_quantity || 0);
            const purchase = Number(item.purchase_price || 0);
            const sale = Number(item.sale_price || 0);
            const profit = sale - purchase;
            const markup = markupPercent(purchase, sale);
            const margin = marginPercent(purchase, sale);
            const lowStock = quantity <= minQuantity;

            return (
              <div
                key={item.id}
                className={`grid min-w-[1650px] grid-cols-13 border-b border-zinc-800 p-4 text-sm ${
                  lowStock ? "bg-red-950/30" : ""
                }`}
              >
                <div>{item.part_number || "-"}</div>
                <div>{item.manufacturer || "-"}</div>
                <div>
                  <p className="font-bold">{item.name}</p>
                  {item.notes && <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>}
                </div>
                <div className={lowStock ? "font-bold text-red-400" : ""}>
                  <div>{quantity}</div>
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={() => changeQuantity(item, -1)} className="rounded bg-zinc-700 px-2 py-1 text-xs font-bold">−1</button>
                    <button type="button" onClick={() => changeQuantity(item, 1)} className="rounded bg-green-600 px-2 py-1 text-xs font-bold">+1</button>
                  </div>
                </div>
                <div>{minQuantity}</div>
                <div>{money(purchase)}</div>
                <div>{money(sale)}</div>
                <div className={profit >= 0 ? "font-bold text-green-400" : "font-bold text-red-400"}>{money(profit)}</div>
                <div className={`font-bold ${marginClass(markup)}`}>{markup.toFixed(1)} %</div>
                <div className={`font-bold ${marginClass(margin)}`}>{margin.toFixed(1)} %</div>
                <div>{item.location || "-"}</div>
                <div>{item.supplier || "-"}</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEdit(item)} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold">Изменить</button>
                  <button type="button" onClick={() => duplicateItem(item)} className="rounded bg-zinc-700 px-3 py-2 text-xs font-bold">Дублировать</button>
                  <button type="button" onClick={() => deleteItem(item.id)} className="rounded bg-red-600 px-3 py-2 text-xs font-bold">Удалить</button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-zinc-400">На складе ничего не найдено.</div>
        )}
      </div>
    </main>
  );
}

function Metric({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function Preview({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-lg bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${className}`}>{value}</p>
    </div>
  );
}