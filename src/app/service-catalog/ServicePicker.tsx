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
};

export default function ServicePicker({
  onSelect,
}: {
  onSelect: (service: ServiceItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadServices() {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        alert(error.message);
        return;
      }

      setServices(data || []);
    }

    loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return services;

    return services.filter((service) =>
      [service.name, service.category, service.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    );
  }, [services, search]);

  function selectService(service: ServiceItem) {
    onSelect(service);
    setSearch("");
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-green-500 px-4 py-2 font-bold text-black"
      >
        + Добавить из каталога
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-green-400">
                Каталог работ
              </h2>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded bg-zinc-800 px-3 py-2 text-sm"
              >
                Закрыть
              </button>
            </div>

            <input
              className="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3"
              placeholder="Поиск работы..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="mt-4 max-h-[500px] overflow-y-auto rounded-lg border border-zinc-800">
              {filteredServices.length ? (
                filteredServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => selectService(service)}
                    className="block w-full border-b border-zinc-800 p-4 text-left hover:bg-zinc-900"
                  >
                    <div className="font-bold text-green-400">
                      {service.name}
                    </div>

                    <div className="mt-1 text-sm text-zinc-400">
                      {service.category || "Без категории"} ·{" "}
                      {service.default_price || 0} € ·{" "}
                      {service.labor_hours || 0} ч
                    </div>

                    {service.description && (
                      <div className="mt-2 text-sm text-zinc-300">
                        {service.description}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-6 text-zinc-400">Ничего не найдено.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}