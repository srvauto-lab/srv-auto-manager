"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadClients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, created_at, client_type, full_name, company_name, phone, email, address, notes"
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
    } else {
      setClients((data || []) as Client[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function deleteClient(client: Client) {
    const displayName =
      client.client_type === "societe"
        ? client.company_name || client.full_name
        : client.full_name;

    const confirmed = confirm(
      `Удалить клиента «${displayName}»?\n\nУдаление может быть запрещено, если у клиента уже есть автомобили или заказ-наряды.`
    );

    if (!confirmed) return;

    setDeletingId(client.id);

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);

    setDeletingId(null);

    if (error) {
      alert(
        error.message.includes("foreign key")
          ? "Нельзя удалить клиента, пока у него есть связанные автомобили или заказ-наряды."
          : error.message
      );
      return;
    }

    await loadClients();
  }

  const filteredClients = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return clients;

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
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [clients, search]);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-green-400">Клиенты</h1>
          <p className="mt-1 text-sm text-zinc-500">
            База клиентов SRV AUTO
          </p>
        </div>

        <Link
          href="/clients/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-black hover:bg-green-400"
        >
          <UserRoundPlus size={18} />
          Добавить клиента
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block w-full max-w-xl">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-green-500"
            placeholder="Имя, фирма, телефон, email, адрес..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <p className="text-sm text-zinc-500">
          Найдено: {filteredClients.length}
        </p>
      </div>

      {loading ? (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Загрузка клиентов...
        </div>
      ) : filteredClients.length ? (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                deleting={deletingId === client.id}
                onDelete={() => deleteClient(client)}
              />
            ))}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 md:block">
            <div className="grid grid-cols-[110px_minmax(180px,1.4fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(220px,1.3fr)] border-b border-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              <div>Тип</div>
              <div>Клиент</div>
              <div>Телефон</div>
              <div>Email</div>
              <div className="text-right">Действия</div>
            </div>

            {filteredClients.map((client) => {
              const displayName =
                client.client_type === "societe"
                  ? client.company_name || client.full_name
                  : client.full_name;

              return (
                <div
                  key={client.id}
                  className="grid grid-cols-[110px_minmax(180px,1.4fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(220px,1.3fr)] items-center border-b border-zinc-800 px-4 py-3 text-sm last:border-b-0 hover:bg-zinc-800/40"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      {client.client_type === "societe" ? (
                        <Building2 size={14} />
                      ) : (
                        <UserRound size={14} />
                      )}

                      {client.client_type === "societe"
                        ? "Société"
                        : "Particulier"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/clients/${client.id}`}
                      className="block truncate font-bold text-green-400 hover:text-green-300"
                    >
                      {displayName || "-"}
                    </Link>

                    {client.client_type === "societe" && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        Контакт: {client.full_name || "-"}
                      </p>
                    )}

                    {client.address && (
                      <p className="mt-0.5 truncate text-xs text-zinc-600">
                        {client.address}
                      </p>
                    )}
                  </div>

                  <div className="truncate">{client.phone || "-"}</div>
                  <div className="truncate">{client.email || "-"}</div>

                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-bold text-black hover:bg-green-400"
                    >
                      <Eye size={15} />
                      Открыть
                    </Link>

                    <Link
                      href={`/clients/${client.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500"
                    >
                      <Pencil size={15} />
                      Изменить
                    </Link>

                    <button
                      type="button"
                      onClick={() => deleteClient(client)}
                      disabled={deletingId === client.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      {deletingId === client.id ? "..." : "Удалить"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">
            {search
              ? "По вашему запросу клиенты не найдены."
              : "Клиентов пока нет."}
          </p>
        </div>
      )}
    </main>
  );
}

function ClientCard({
  client,
  deleting,
  onDelete,
}: {
  client: Client;
  deleting: boolean;
  onDelete: () => void;
}) {
  const displayName =
    client.client_type === "societe"
      ? client.company_name || client.full_name
      : client.full_name;

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
            {client.client_type === "societe" ? (
              <Building2 size={14} />
            ) : (
              <UserRound size={14} />
            )}

            {client.client_type === "societe" ? "Société" : "Particulier"}
          </span>

          <Link
            href={`/clients/${client.id}`}
            className="mt-3 block truncate text-lg font-bold text-green-400"
          >
            {displayName || "-"}
          </Link>

          {client.client_type === "societe" && (
            <p className="mt-1 text-sm text-zinc-500">
              Контакт: {client.full_name || "-"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <InfoLine icon={Phone} value={client.phone} />
        <InfoLine icon={Mail} value={client.email} />
        <InfoLine icon={MapPin} value={client.address} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2.5 text-xs font-bold text-black"
        >
          <Eye size={15} />
          Открыть
        </Link>

        <Link
          href={`/clients/${client.id}/edit`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold"
        >
          <Pencil size={15} />
          Изменить
        </Link>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-bold disabled:opacity-50"
        >
          <Trash2 size={15} />
          {deleting ? "..." : "Удалить"}
        </button>
      </div>
    </article>
  );
}

function InfoLine({
  icon: Icon,
  value,
}: {
  icon: typeof Phone;
  value: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-zinc-400">
      <Icon size={16} className="shrink-0 text-zinc-600" />
      <span className="truncate">{value || "-"}</span>
    </div>
  );
}