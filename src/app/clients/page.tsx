"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  created_at: string;
  client_type: string | null;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadClients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setClients(data || []);

    setLoading(false);
  }

  async function deleteClient(id: string) {
    if (!confirm("Удалить этого клиента?")) return;

    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) alert(error.message);
    else await loadClients();
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;

    return clients.filter((client) =>
      [
        client.full_name,
        client.company_name,
        client.phone,
        client.email,
        client.address,
        client.notes,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    );
  }, [clients, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Клиенты</h1>
          <p className="mt-2 text-zinc-400">База клиентов SRV AUTO</p>
        </div>

        <Link
          href="/clients/new"
          className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400"
        >
          Добавить клиента
        </Link>
      </div>

      <input
        className="mt-6 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-white"
        placeholder="Поиск по имени, фирме, телефону, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="grid min-w-[1100px] grid-cols-7 border-b border-zinc-800 p-4 text-sm font-semibold text-zinc-400">
          <div>Тип</div>
          <div>Клиент / фирма</div>
          <div>Контакт</div>
          <div>Телефон</div>
          <div>Email</div>
          <div>Адрес</div>
          <div>Действия</div>
        </div>

        {loading ? (
          <div className="p-6 text-zinc-400">Загрузка...</div>
        ) : filteredClients.length ? (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="grid min-w-[1100px] grid-cols-7 border-b border-zinc-800 p-4 text-sm"
            >
              <div>
                {client.client_type === "societe" ? "Société" : "Particulier"}
              </div>

              <div className="font-bold text-green-400">
                {client.client_type === "societe"
                  ? client.company_name || "-"
                  : client.full_name}
              </div>

              <div>{client.full_name || "-"}</div>
              <div>{client.phone || "-"}</div>
              <div>{client.email || "-"}</div>
              <div>{client.address || "-"}</div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/clients/${client.id}/edit`}
                  className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  Изменить
                </Link>

                <button
                  onClick={() => deleteClient(client.id)}
                  className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-zinc-400">Клиентов пока нет.</div>
        )}
      </div>
    </main>
  );
}