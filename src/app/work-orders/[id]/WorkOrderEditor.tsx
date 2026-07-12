"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ServicePicker from "@/app/service-catalog/ServicePicker";
import WorkOrderPayments from "@/components/WorkOrderPayments";

type Props = {
  order: any;
  laborItems: any[];
  partItems: any[];
};

type InventoryItem = {
  id: string;
  name: string;
  part_number: string | null;
  manufacturer: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  quantity: number | null;
};

function parseMileage(value: unknown) {
  const cleaned = String(value ?? "").replace(/\s/g, "").replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function WorkOrderEditor({ order, laborItems, partItems }: Props) {
  const router = useRouter();

  const [mileage, setMileage] = useState(order.mileage || "");
  const [complaint, setComplaint] = useState(order.customer_complaint || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [labors, setLabors] = useState(laborItems || []);
  const [parts, setParts] = useState(partItems || []);
  const [originalParts, setOriginalParts] = useState(partItems || []);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("id, name, part_number, manufacturer, purchase_price, sale_price, quantity")
      .order("name", { ascending: true });

    if (error) alert(error.message);
    else setInventoryItems(data || []);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const laborTotal = labors.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );

  const partsTotal = parts.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );

  const partsCostTotal = parts.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.purchase_price || 0),
    0
  );

  const partsProfit = partsTotal - partsCostTotal;
  const totalAmount = laborTotal + partsTotal;
  const grossProfit = laborTotal + partsProfit;
  const marginPercent = totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0;

  function addLabor() {
    setLabors([
      ...labors,
      {
        id: `new-labor-${Date.now()}`,
        isNew: true,
        description: "",
        quantity: 1,
        unit_price: 0,
        total: 0,
      },
    ]);
  }

  function addPart() {
    setParts([
      ...parts,
      {
        id: `new-part-${Date.now()}`,
        isNew: true,
        inventory_item_id: "",
        stock_deducted: false,
        name: "",
        reference: "",
        quantity: 1,
        purchase_price: 0,
        unit_price: 0,
        profit: 0,
        total: 0,
      },
    ]);
  }

  function removeLabor(index: number) {
    setLabors(labors.filter((_, itemIndex) => itemIndex !== index));
  }

  async function moveInventory({
    inventoryItemId,
    workOrderPartItemId,
    quantity,
    movementType,
    note,
  }: {
    inventoryItemId: string;
    workOrderPartItemId?: string | null;
    quantity: number;
    movementType: string;
    note: string;
  }) {
    if (!inventoryItemId || quantity === 0) return true;

    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("id", inventoryItemId)
      .single();

    if (inventoryError || !inventoryItem) {
      alert(inventoryError?.message || "Позиция склада не найдена");
      return false;
    }

    const nextQuantity = Number(inventoryItem.quantity || 0) + quantity;

    if (nextQuantity < 0) {
      alert("Недостаточно остатка на складе для списания.");
      return false;
    }

    const { error: updateError } = await supabase
      .from("inventory")
      .update({ quantity: nextQuantity })
      .eq("id", inventoryItemId);

    if (updateError) {
      alert(updateError.message);
      return false;
    }

    const { error: movementError } = await supabase
      .from("inventory_movements")
      .insert({
        inventory_item_id: inventoryItemId,
        work_order_id: order.id,
        work_order_part_item_id: workOrderPartItemId || null,
        movement_type: movementType,
        quantity,
        note,
      });

    if (movementError) {
      alert(movementError.message);
      return false;
    }

    return true;
  }

  async function removePart(index: number) {
    const item = parts[index];
    if (!item) return;

    if (item.isNew) {
      setParts(parts.filter((_, itemIndex) => itemIndex !== index));
      return;
    }

    if (!confirm("Удалить запчасть из заказ-наряда?")) return;

    setSaving(true);

    if (item.inventory_item_id && item.stock_deducted) {
      const returned = await moveInventory({
        inventoryItemId: item.inventory_item_id,
        workOrderPartItemId: item.id,
        quantity: Number(item.quantity || 0),
        movementType: "work_order_part_return_delete",
        note: `Возврат при удалении запчасти из заказ-наряда ${order.order_number || order.id}`,
      });

      if (!returned) {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from("work_order_part_items")
      .delete()
      .eq("id", item.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setParts(parts.filter((_, itemIndex) => itemIndex !== index));
    setOriginalParts(originalParts.filter((part) => part.id !== item.id));
    await loadInventory();
    router.refresh();
  }

  function selectInventoryPart(index: number, inventoryId: string) {
    const selected = inventoryItems.find((item) => item.id === inventoryId);
    const copy = [...parts];

    copy[index].inventory_item_id = inventoryId || null;

    if (selected) {
      copy[index].name = selected.name || "";
      copy[index].reference = selected.part_number || "";
      copy[index].purchase_price = Number(selected.purchase_price || 0);
      copy[index].unit_price = Number(selected.sale_price || 0);
      copy[index].profit =
        Number(selected.sale_price || 0) - Number(selected.purchase_price || 0);
    }

    setParts(copy);
  }

  async function handleStockForSavedPart(savedPart: any, previousPart?: any) {
    const inventoryId = savedPart.inventory_item_id;
    const quantity = Number(savedPart.quantity || 0);

    if (!inventoryId || quantity <= 0) return true;

    if (!savedPart.stock_deducted) {
      const deducted = await moveInventory({
        inventoryItemId: inventoryId,
        workOrderPartItemId: savedPart.id,
        quantity: -quantity,
        movementType: "work_order_part_deduct",
        note: `Списание по заказ-наряду ${order.order_number || order.id}`,
      });

      if (!deducted) return false;

      const { error } = await supabase
        .from("work_order_part_items")
        .update({ stock_deducted: true })
        .eq("id", savedPart.id);

      if (error) {
        alert(error.message);
        return false;
      }

      savedPart.stock_deducted = true;
      return true;
    }

    if (
      previousPart?.stock_deducted &&
      previousPart?.inventory_item_id === inventoryId
    ) {
      const difference =
        quantity - Number(previousPart.quantity || 0);

      if (difference === 0) return true;

      return moveInventory({
        inventoryItemId: inventoryId,
        workOrderPartItemId: savedPart.id,
        quantity: -difference,
        movementType:
          difference > 0
            ? "work_order_part_deduct_adjust"
            : "work_order_part_return_adjust",
        note: `Корректировка количества в заказ-наряде ${order.order_number || order.id}`,
      });
    }

    return true;
  }

  async function saveMileageHistory() {
    const vehicleId = order.vehicle_id || order.vehicles?.id;
    const parsedMileage = parseMileage(mileage);

    if (!vehicleId || parsedMileage === null) return true;

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, mileage")
      .eq("id", vehicleId)
      .single();

    if (vehicleError || !vehicle) {
      alert(vehicleError?.message || "Автомобиль не найден.");
      return false;
    }

    const currentMileage = parseMileage(vehicle.mileage) ?? 0;
    let correctionNote = "";

    if (currentMileage > 0 && parsedMileage < currentMileage) {
      const confirmed = confirm(
        `Введённый пробег ${parsedMileage.toLocaleString("ru-RU")} км меньше текущего ${currentMileage.toLocaleString("ru-RU")} км.\n\nСохранить как корректировку?`
      );

      if (!confirmed) return false;

      const reason = prompt("Причина уменьшения пробега:");
      if (!reason?.trim()) {
        alert("Нужно указать причину.");
        return false;
      }

      correctionNote = reason.trim();
    }

    const { data: existing, error: historyReadError } = await supabase
      .from("vehicle_mileage_history")
      .select("id")
      .eq("work_order_id", order.id)
      .maybeSingle();

    if (historyReadError) {
      alert(historyReadError.message);
      return false;
    }

    const payload = {
      vehicle_id: vehicleId,
      work_order_id: order.id,
      mileage: parsedMileage,
      source: correctionNote ? "work_order_correction" : "work_order",
      note:
        correctionNote ||
        `Пробег зафиксирован в заказ-наряде ${order.order_number || order.id}`,
      recorded_at: new Date().toISOString(),
    };

    const result = existing
      ? await supabase
          .from("vehicle_mileage_history")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("vehicle_mileage_history").insert(payload);

    if (result.error) {
      alert(result.error.message);
      return false;
    }

    if (parsedMileage >= currentMileage || correctionNote) {
      const { error } = await supabase
        .from("vehicles")
        .update({ mileage: parsedMileage })
        .eq("id", vehicleId);

      if (error) {
        alert(error.message);
        return false;
      }
    }

    return true;
  }

  async function saveAll() {
    if (saving) return;

    const parsedMileage = parseMileage(mileage);

    if (String(mileage).trim() && parsedMileage === null) {
      alert("Пробег должен быть числом.");
      return;
    }

    const invalidLabor = labors.some(
      (item) =>
        Number(item.quantity || 0) < 0 ||
        Number(item.unit_price || 0) < 0
    );

    const invalidPart = parts.some(
      (item) =>
        Number(item.quantity || 0) < 0 ||
        Number(item.purchase_price || 0) < 0 ||
        Number(item.unit_price || 0) < 0
    );

    if (invalidLabor || invalidPart) {
      alert("Количество и цены не могут быть отрицательными.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      for (const item of labors) {
        const payload = {
          work_order_id: order.id,
          description: item.description || "",
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          total: Number(item.quantity || 0) * Number(item.unit_price || 0),
        };

        const result = item.isNew
          ? await supabase.from("work_order_labor_items").insert(payload)
          : await supabase
              .from("work_order_labor_items")
              .update(payload)
              .eq("id", item.id);

        if (result.error) throw result.error;
      }

      const savedParts: any[] = [];

      for (const item of parts) {
        const quantity = Number(item.quantity || 0);
        const purchasePrice = Number(item.purchase_price || 0);
        const salePrice = Number(item.unit_price || 0);

        const payload = {
          work_order_id: order.id,
          inventory_item_id: item.inventory_item_id || null,
          stock_deducted: item.stock_deducted || false,
          name: item.name || "",
          reference: item.reference || "",
          quantity,
          purchase_price: purchasePrice,
          unit_price: salePrice,
          profit: (salePrice - purchasePrice) * quantity,
          total: salePrice * quantity,
        };

        const result = item.isNew
          ? await supabase
              .from("work_order_part_items")
              .insert(payload)
              .select("*")
              .single()
          : await supabase
              .from("work_order_part_items")
              .update(payload)
              .eq("id", item.id)
              .select("*")
              .single();

        if (result.error) throw result.error;

        const previousPart = originalParts.find(
          (part) => part.id === result.data.id
        );

        const stockOk = await handleStockForSavedPart(
          result.data,
          previousPart
        );

        if (!stockOk) return;

        savedParts.push({
          ...result.data,
          isNew: false,
          stock_deducted:
            result.data.stock_deducted ||
            Boolean(result.data.inventory_item_id),
        });
      }

      const { error: orderError } = await supabase
        .from("work_orders")
        .update({
          mileage: parsedMileage === null ? "" : String(parsedMileage),
          customer_complaint: complaint,
          notes,
          labor_total: laborTotal,
          parts_total: partsTotal,
          parts_cost_total: partsCostTotal,
          total_amount: totalAmount,
          gross_profit: grossProfit,
          margin_percent: marginPercent,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      const mileageSaved = await saveMileageHistory();
      if (!mileageSaved) return;

      if (savedParts.length) {
        setParts(savedParts);
        setOriginalParts(savedParts);
      }

      setMessage("Сохранено. Себестоимость, прибыль и маржа пересчитаны.");
      await loadInventory();
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Не удалось сохранить заказ-наряд.");
    } finally {
      setSaving(false);
    }
  }

  const inventoryLabel = (item: InventoryItem) =>
    [
      item.manufacturer,
      item.part_number,
      item.name,
      `закупка: ${money(item.purchase_price)}`,
      `продажа: ${money(item.sale_price)}`,
      `остаток: ${item.quantity || 0}`,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-green-400">Основное</h2>

        <div className="mt-4 max-w-md">
          <label className="mb-2 block text-sm text-zinc-400">
            Пробег при этом визите
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-lg bg-zinc-950 p-3"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>

        <textarea className="mt-4 w-full rounded-lg bg-zinc-950 p-3" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Жалоба клиента" />
        <textarea className="mt-4 w-full rounded-lg bg-zinc-950 p-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Комментарий" />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-green-400">Работы</h2>
          <div className="flex flex-wrap gap-3">
            <ServicePicker
              onSelect={(service) =>
                setLabors([
                  ...labors,
                  {
                    id: `new-labor-${Date.now()}`,
                    isNew: true,
                    description: service.name,
                    quantity: 1,
                    unit_price: service.default_price || 0,
                    total: service.default_price || 0,
                  },
                ])
              }
            />
            <button type="button" onClick={addLabor} className="rounded bg-green-500 px-4 py-2 font-bold text-black">
              + Добавить работу
            </button>
          </div>
        </div>

        {labors.map((item, index) => (
          <div key={item.id} className="mt-4 grid gap-3 md:grid-cols-5">
            <input className="rounded bg-zinc-950 p-3" value={item.description || ""} onChange={(e) => { const copy = [...labors]; copy[index].description = e.target.value; setLabors(copy); }} />
            <input className="rounded bg-zinc-950 p-3" value={item.quantity || ""} onChange={(e) => { const copy = [...labors]; copy[index].quantity = e.target.value; setLabors(copy); }} />
            <input className="rounded bg-zinc-950 p-3" value={item.unit_price || ""} onChange={(e) => { const copy = [...labors]; copy[index].unit_price = e.target.value; setLabors(copy); }} />
            <div className="rounded bg-zinc-950 p-3 text-green-400">{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</div>
            <button type="button" onClick={() => removeLabor(index)} className="rounded bg-red-600 px-3 py-2 text-sm font-bold">Удалить</button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-green-400">Запчасти</h2>
          <button type="button" onClick={addPart} className="rounded bg-green-500 px-4 py-2 font-bold text-black">
            + Добавить запчасть
          </button>
        </div>

        {parts.map((item, index) => {
          const quantity = Number(item.quantity || 0);
          const purchase = Number(item.purchase_price || 0);
          const sale = Number(item.unit_price || 0);
          const profit = (sale - purchase) * quantity;

          return (
            <div key={item.id} className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-3 md:grid-cols-7">
                <select
                  className="rounded bg-zinc-900 p-3 md:col-span-2"
                  value={item.inventory_item_id || ""}
                  onChange={(e) => selectInventoryPart(index, e.target.value)}
                  disabled={item.stock_deducted}
                >
                  <option value="">Выбрать со склада</option>
                  {inventoryItems.map((inventoryItem) => (
                    <option key={inventoryItem.id} value={inventoryItem.id}>
                      {inventoryLabel(inventoryItem)}
                    </option>
                  ))}
                </select>

                <input className="rounded bg-zinc-900 p-3" placeholder="Название" value={item.name || ""} onChange={(e) => { const copy = [...parts]; copy[index].name = e.target.value; setParts(copy); }} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Артикул" value={item.reference || ""} onChange={(e) => { const copy = [...parts]; copy[index].reference = e.target.value; setParts(copy); }} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Кол-во" value={item.quantity || ""} onChange={(e) => { const copy = [...parts]; copy[index].quantity = e.target.value; setParts(copy); }} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Закупка" value={item.purchase_price || ""} onChange={(e) => { const copy = [...parts]; copy[index].purchase_price = e.target.value; setParts(copy); }} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Продажа" value={item.unit_price || ""} onChange={(e) => { const copy = [...parts]; copy[index].unit_price = e.target.value; setParts(copy); }} />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Preview label="Себестоимость" value={money(purchase * quantity)} className="text-blue-400" />
                <Preview label="Продажа" value={money(sale * quantity)} className="text-white" />
                <Preview label="Прибыль" value={money(profit)} className={profit >= 0 ? "text-green-400" : "text-red-400"} />
                <Preview label="Маржа" value={`${sale > 0 ? (((sale - purchase) / sale) * 100).toFixed(1) : "0.0"} %`} className="text-orange-400" />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                  {item.stock_deducted
                    ? "Списано со склада"
                    : item.inventory_item_id
                    ? "Будет списано при сохранении"
                    : "Ручная запчасть"}
                </p>
                <button type="button" onClick={() => removePart(index)} disabled={saving} className="rounded bg-red-600 px-3 py-2 text-sm font-bold disabled:opacity-50">
                  Удалить
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <WorkOrderPayments workOrder={order} />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric title="Работы" value={money(laborTotal)} accent="text-green-400" />
          <Metric title="Запчасти продажа" value={money(partsTotal)} accent="text-white" />
          <Metric title="Закупка запчастей" value={money(partsCostTotal)} accent="text-blue-400" />
          <Metric title="Прибыль запчастей" value={money(partsProfit)} accent="text-green-400" />
          <Metric title="Общая прибыль" value={money(grossProfit)} accent="text-green-400" />
          <Metric title="Маржа" value={`${marginPercent.toFixed(1)} %`} accent="text-orange-400" />
        </div>

        <p className="mt-5 text-2xl">
          Итого клиенту: <b className="text-green-400">{money(totalAmount)}</b>
        </p>

        <button
          type="button"
          disabled={saving}
          onClick={saveAll}
          className="mt-5 rounded-lg bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
        >
          {saving ? "Сохраняем..." : "Сохранить изменения"}
        </button>

        {message && <p className="mt-3 text-green-400">{message}</p>}
      </div>
    </div>
  );
}

function Preview({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 font-bold ${className}`}>{value}</p>
    </div>
  );
}

function Metric({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className={`mt-2 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}