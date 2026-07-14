"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
};

export default function NewVehiclePage() {
  const router = useRouter();

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
    async function loadClients() {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone")
        .order("full_name", { ascending: true });

      if (error) {
        alert(error.message);
        return;
      }

      setClients(data || []);
    }

    loadClients();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("vehicles").insert({
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
    });

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
      <h1 className="text-3xl font-bold text-green-400">Добавить автомобиль</h1>
      <p className="mt-2 text-zinc-400">Новый автомобиль SRV AUTO</p>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-4">
        <select
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">Выбрать клиента</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name} {client.phone ? `— ${client.phone}` : ""}
            </option>
          ))}
        </select>

        <div className="grid gap-4 md:grid-cols-2">
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="VIN" value={vin} onChange={(e) => setVin(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Госномер" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Марка *" value={brand} onChange={(e) => setBrand(e.target.value)} required />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Модель *" value={model} onChange={(e) => setModel(e.target.value)} required />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Год" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Двигатель" value={engine} onChange={(e) => setEngine(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Пробег" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Топливо" value={fuel} onChange={(e) => setFuel(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="КПП" value={gearbox} onChange={(e) => setGearbox(e.target.value)} />
          <input className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white" placeholder="Цвет" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>

        <textarea
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
          placeholder="Примечания"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400 disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить автомобиль"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/vehicles")}
            className="rounded-lg border border-zinc-700 px-5 py-3 text-zinc-300 hover:bg-zinc-800"
          >
            Отмена
          </button>
        </div>
      </form>
    </main>
  );
}
