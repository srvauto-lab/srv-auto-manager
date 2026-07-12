"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ServicePicker from "@/app/service-catalog/ServicePicker";

type Client = { id: string; full_name: string; phone: string | null };
type Vehicle = { id: string; client_id: string | null; brand: string; model: string; plate: string | null; vin: string | null };
type LaborItem = { description: string; quantity: string; unit_price: string };
type PartItem = { name: string; reference: string; quantity: string; unit_price: string };

export default function NewWorkOrderPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [customerComplaint, setCustomerComplaint] = useState("");
  const [status, setStatus] = useState("Nouveau");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [laborItems, setLaborItems] = useState<LaborItem[]>([
    { description: "", quantity: "1", unit_price: "0" },
  ]);

  const [partItems, setPartItems] = useState<PartItem[]>([
    { name: "", reference: "", quantity: "1", unit_price: "0" },
  ]);

  useEffect(() => {
    async function loadData() {
      const { data: clientsData } = await supabase.from("clients").select("id, full_name, phone").order("full_name");
      const { data: vehiclesData } = await supabase.from("vehicles").select("id, client_id, brand, model, plate, vin").order("created_at", { ascending: false });
      setClients(clientsData || []);
      setVehicles(vehiclesData || []);
    }
    loadData();
  }, []);

  const filteredVehicles = clientId ? vehicles.filter((v) => v.client_id === clientId) : vehicles;

  const laborTotal = useMemo(
    () => laborItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
    [laborItems]
  );

  const partsTotal = useMemo(
    () => partItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
    [partItems]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: order, error: orderError } = await supabase
      .from("work_orders")
      .insert({
        client_id: clientId || null,
        vehicle_id: vehicleId || null,
        mileage,
        customer_complaint: customerComplaint,
        work_description: laborItems.map((i) => i.description).filter(Boolean).join("\n"),
        status,
        labor_total: laborTotal,
        parts_total: partsTotal,
        total_amount: laborTotal + partsTotal,
        notes,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setSaving(false);
      alert(orderError?.message || "Erreur création ordre");
      return;
    }

    const cleanLabor = laborItems
      .filter((i) => i.description.trim())
      .map((i) => ({
        work_order_id: order.id,
        description: i.description,
        quantity: Number(i.quantity || 0),
        unit_price: Number(i.unit_price || 0),
        total: Number(i.quantity || 0) * Number(i.unit_price || 0),
      }));

    const cleanParts = partItems
      .filter((i) => i.name.trim())
      .map((i) => ({
        work_order_id: order.id,
        name: i.name,
        reference: i.reference,
        quantity: Number(i.quantity || 0),
        unit_price: Number(i.unit_price || 0),
        total: Number(i.quantity || 0) * Number(i.unit_price || 0),
      }));

    if (cleanLabor.length) await supabase.from("work_order_labor_items").insert(cleanLabor);
    if (cleanParts.length) await supabase.from("work_order_part_items").insert(cleanParts);

    setSaving(false);
    router.push("/work-orders");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Создать заказ-наряд</h1>

      <form onSubmit={handleSubmit} className="mt-8 max-w-5xl space-y-6">
        <select className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" value={clientId} onChange={(e) => { setClientId(e.target.value); setVehicleId(""); }}>
          <option value="">Выбрать клиента</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `— ${c.phone}` : ""}</option>)}
        </select>

        <select className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">Выбрать автомобиль</option>
          {filteredVehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {v.plate ? `— ${v.plate}` : ""}</option>)}
        </select>

        <input className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Пробег" value={mileage} onChange={(e) => setMileage(e.target.value)} />

        <textarea className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Жалоба клиента" value={customerComplaint} onChange={(e) => setCustomerComplaint(e.target.value)} />

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-bold text-green-400">Работы</h2>
          <div className="mt-4">
  <ServicePicker
    onSelect={(service) => {
  setLaborItems([
    ...laborItems,
    {
      description: service.name,
      quantity: "1",
      unit_price: String(service.default_price || 0),
    },
  ]);

  if (service.recommended_parts) {
    const newParts = service.recommended_parts
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({
        name: part,
        reference: "",
        quantity: "1",
        unit_price: "0",
      }));

    setPartItems([...partItems, ...newParts]);
  }
}}
  />
</div>
          {laborItems.map((item, index) => (
            <div key={index} className="mt-4 grid gap-3 md:grid-cols-4">
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Работа" value={item.description} onChange={(e) => {
                const copy = [...laborItems]; copy[index].description = e.target.value; setLaborItems(copy);
              }} />
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Кол-во" value={item.quantity} onChange={(e) => {
                const copy = [...laborItems]; copy[index].quantity = e.target.value; setLaborItems(copy);
              }} />
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Цена €" value={item.unit_price} onChange={(e) => {
                const copy = [...laborItems]; copy[index].unit_price = e.target.value; setLaborItems(copy);
              }} />
              <div className="rounded-lg bg-zinc-950 p-3 text-green-400">
                {Number(item.quantity || 0) * Number(item.unit_price || 0)} €
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setLaborItems([...laborItems, { description: "", quantity: "1", unit_price: "0" }])} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2">
            + Добавить работу
          </button>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-bold text-green-400">Запчасти</h2>
          {partItems.map((item, index) => (
            <div key={index} className="mt-4 grid gap-3 md:grid-cols-5">
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Запчасть" value={item.name} onChange={(e) => {
                const copy = [...partItems]; copy[index].name = e.target.value; setPartItems(copy);
              }} />
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Артикул" value={item.reference} onChange={(e) => {
                const copy = [...partItems]; copy[index].reference = e.target.value; setPartItems(copy);
              }} />
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Кол-во" value={item.quantity} onChange={(e) => {
                const copy = [...partItems]; copy[index].quantity = e.target.value; setPartItems(copy);
              }} />
              <input className="rounded-lg bg-zinc-950 p-3" placeholder="Цена €" value={item.unit_price} onChange={(e) => {
                const copy = [...partItems]; copy[index].unit_price = e.target.value; setPartItems(copy);
              }} />
              <div className="rounded-lg bg-zinc-950 p-3 text-green-400">
                {Number(item.quantity || 0) * Number(item.unit_price || 0)} €
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPartItems([...partItems, { name: "", reference: "", quantity: "1", unit_price: "0" }])} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2">
            + Добавить запчасть
          </button>
        </section>

        <select className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Nouveau">Nouveau</option>
          <option value="En cours">En cours</option>
          <option value="En attente pièces">En attente pièces</option>
          <option value="Terminé">Terminé</option>
          <option value="Facturé">Facturé</option>
        </select>

        <textarea className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Комментарий" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p>Работы: <b className="text-green-400">{laborTotal} €</b></p>
          <p>Запчасти: <b className="text-green-400">{partsTotal} €</b></p>
          <p className="mt-2 text-xl">Итого: <b className="text-green-400">{laborTotal + partsTotal} €</b></p>
        </div>

        <button disabled={saving} className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black">
          {saving ? "Сохраняем..." : "Сохранить заказ-наряд"}
        </button>
      </form>
    </main>
  );
}