"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  client_type: string | null;
};

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuel, setFuel] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, full_name, phone, company_name, client_type")
        .order("full_name", { ascending: true });

      const { data: vehicle, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      setClients(clientsData || []);
      setClientId(vehicle.client_id || "");
      setVin(vehicle.vin || "");
      setPlate(vehicle.plate || "");
      setBrand(vehicle.brand || "");
      setModel(vehicle.model || "");
      setYear(vehicle.year || "");
      setEngine(vehicle.engine || "");
      setMileage(vehicle.mileage || "");
      setFuel(vehicle.fuel || "");
      setGearbox(vehicle.gearbox || "");
      setColor(vehicle.color || "");
      setNotes(vehicle.notes || "");
    }

    loadData();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("vehicles")
      .update({
        client_id: clientId || null,
        vin,
        plate,
        brand,
        model,
        year,
        engine,
        mileage,
        fuel,
        gearbox,
        color,
        notes,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/vehicles");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">
        Редактировать автомобиль
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-4">
        <select
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">Выбрать клиента</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_type === "societe"
                ? client.company_name || client.full_name
                : client.full_name}
              {client.phone ? ` — ${client.phone}` : ""}
            </option>
          ))}
        </select>

        <div className="grid gap-4 md:grid-cols-2">
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="VIN" value={vin} onChange={(e) => setVin(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Госномер" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Марка *" value={brand} onChange={(e) => setBrand(e.target.value)} required />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Модель *" value={model} onChange={(e) => setModel(e.target.value)} required />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Год" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Двигатель" value={engine} onChange={(e) => setEngine(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Пробег" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Топливо" value={fuel} onChange={(e) => setFuel(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="КПП" value={gearbox} onChange={(e) => setGearbox(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Цвет" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>

        <textarea
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          placeholder="Примечания"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить изменения"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/vehicles")}
            className="rounded-lg border border-zinc-700 px-5 py-3"
          >
            Отмена
          </button>
        </div>
      </form>
    </main>
  );
}