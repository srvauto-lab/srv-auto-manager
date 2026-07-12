"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Result = {
  type: string;
  title: string;
  subtitle: string;
  href: string;
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const showResults = useMemo(() => query.trim().length >= 2, [query]);

  async function search(value: string) {
    setQuery(value);

    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    const [clientsRes, vehiclesRes, ordersRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name, phone, email")
        .or(
          `full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
        )
        .limit(5),

      supabase
        .from("vehicles")
        .select("id, brand, model, plate, vin")
        .or(`brand.ilike.%${q}%,model.ilike.%${q}%,plate.ilike.%${q}%,vin.ilike.%${q}%`)
        .limit(5),

      supabase
        .from("work_orders")
        .select("id, order_number, status")
        .or(`order_number.ilike.%${q}%,status.ilike.%${q}%`)
        .limit(5),
    ]);

    const nextResults: Result[] = [];

    (clientsRes.data || []).forEach((client: any) => {
      nextResults.push({
        type: "Клиент",
        title: client.company_name || client.full_name || "Без имени",
        subtitle: `${client.phone || "-"} · ${client.email || "-"}`,
        href: `/clients/${client.id}/edit`,
      });
    });

    (vehiclesRes.data || []).forEach((vehicle: any) => {
      nextResults.push({
        type: "Автомобиль",
        title: `${vehicle.brand || ""} ${vehicle.model || ""}`,
        subtitle: `${vehicle.plate || "-"} · VIN: ${vehicle.vin || "-"}`,
        href: `/vehicles/${vehicle.id}`,
      });
    });

    (ordersRes.data || []).forEach((order: any) => {
      nextResults.push({
        type: "Заказ-наряд",
        title: order.order_number || "Без номера",
        subtitle: `Статус: ${order.status || "-"}`,
        href: `/work-orders/${order.id}`,
      });
    });

    setResults(nextResults);
    setLoading(false);
  }

  return (
    <div className="relative w-full max-w-xl">
      <input
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-white"
        placeholder="Поиск: клиент, телефон, VIN, номер, заказ..."
        value={query}
        onChange={(e) => search(e.target.value)}
      />

      {showResults && (
        <div className="absolute left-0 right-0 top-14 z-50 max-h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl">
          {loading ? (
            <div className="p-4 text-sm text-zinc-400">Поиск...</div>
          ) : results.length ? (
            results.map((result, index) => (
              <Link
                key={index}
                href={result.href}
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="block border-b border-zinc-800 p-4 hover:bg-zinc-900"
              >
                <p className="text-xs text-green-400">{result.type}</p>
                <p className="font-bold text-white">{result.title}</p>
                <p className="text-sm text-zinc-400">{result.subtitle}</p>
              </Link>
            ))
          ) : (
            <div className="p-4 text-sm text-zinc-400">Ничего не найдено.</div>
          )}
        </div>
      )}
    </div>
  );
}