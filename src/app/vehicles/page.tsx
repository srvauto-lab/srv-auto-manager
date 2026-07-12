"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Vehicle = {
  id: string;
  created_at: string;
  client_id: string | null;
  vin: string | null;
  plate: string | null;
  brand: string;
  model: string;
  year: string | null;
  engine: string | null;
  mileage: string | null;
  fuel: string | null;
  gearbox: string | null;
  color: string | null;
  notes: string | null;
  clients?: {
    full_name: string;
    phone: string | null;
  } | null;
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadVehicles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("vehicles")
      .select("*, clients(full_name, phone)")
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setVehicles(data || []);

    setLoading(false);
  }

  async function deleteVehicle(id: string) {
    if (!confirm("Удалить этот автомобиль?")) return;

    const { error } = await supabase.from("vehicles").delete().eq("id", id);

    if (error) alert(error.message);
    else await loadVehicles();
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;

    return vehicles.filter((vehicle) =>
      [
        vehicle.vin,
        vehicle.plate,
        vehicle.brand,
        vehicle.model,
        vehicle.engine,
        vehicle.fuel,
        vehicle.gearbox,
        vehicle.color,
        vehicle.notes,
        vehicle.clients?.full_name,
        vehicle.clients?.phone,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Автомобили</h1>
          <p className="mt-2 text-zinc-400">База автомобилей SRV AUTO</p>
        </div>

        <Link
          href="/vehicles/new"
          className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400"
        >
          Добавить автомобиль
        </Link>
      </div>

      <input
        className="mt-6 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
        placeholder="Поиск по VIN, номеру, марке, клиенту..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1250px] grid-cols-10 border-b border-zinc-800 p-4 text-sm font-semibold text-zinc-400">
          <div>Клиент</div>
          <div>Госномер</div>
          <div>VIN</div>
          <div>Марка</div>
          <div>Модель</div>
          <div>Год</div>
          <div>Двигатель</div>
          <div>Пробег</div>
          <div>Топливо</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filteredVehicles.length ? (
          filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="grid min-w-[1250px] grid-cols-10 border-b border-zinc-800 p-4 text-sm"
            >
              <div>{vehicle.clients?.full_name || "-"}</div>
              <div>{vehicle.plate || "-"}</div>
              <div>{vehicle.vin || "-"}</div>
              <div>{vehicle.brand}</div>
              <div>{vehicle.model}</div>
              <div>{vehicle.year || "-"}</div>
              <div>{vehicle.engine || "-"}</div>
              <div>{vehicle.mileage || "-"}</div>
              <div>{vehicle.fuel || "-"}</div>

              <div className="flex flex-wrap gap-2">
    <Link
        href={`/vehicles/${vehicle.id}`}
        className="rounded bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500"
    >
        Открыть
    </Link>

    <Link
        href={`/vehicles/${vehicle.id}/edit`}
        className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
    >
        Изменить
    </Link>

    <button
        onClick={() => deleteVehicle(vehicle.id)}
        className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500"
    >
        Удалить
    </button>
</div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Автомобилей пока нет.</div>
        )}
      </div>
    </main>
  );
} 