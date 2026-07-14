"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Car,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ClientCommunications from "@/components/ClientCommunications";

type Client = {
  id: string;
  created_at: string;
  client_type: string | null;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  billing_address?: string | null;
  delivery_address?: string | null;
  siren?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  notes: string | null;
};

type Vehicle = {
  id: string;
  brand: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
  year: string | number | null;
  mileage: string | number | null;
};

type WorkOrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  vehicle_id: string | null;
  vehicles: Vehicle | Vehicle[] | null;
};

type WorkOrder = Omit<WorkOrderRow, "vehicles"> & {
  vehicle: Vehicle | null;
};

type Devis = {
  id: string;
  devis_number: string | null;
  work_order_id: string;
  created_at: string;
  status: string | null;
  total_ttc: number | null;
  seller: string | null;
  lang: string | null;
};

type Facture = {
  id: string;
  facture_number: string | null;
  work_order_id: string;
  created_at: string;
  status: string | null;
  total_ttc: number | null;
  seller: string | null;
  lang: string | null;
};

type Payment = {
  id: string;
  work_order_id: string;
  amount: number | null;
  payment_method: string | null;
  payment_date: string;
  note: string | null;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  title: string;
  status: string | null;
  vehicle_id: string | null;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

function normalizeVehicle(
  relation: Vehicle | Vehicle[] | null | undefined
): Vehicle | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function mileage(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/\s/g, ""));
  return Number.isFinite(parsed) && parsed > 0
    ? `${parsed.toLocaleString("ru-RU")} км`
    : "-";
}

function statusClass(status: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized.includes("paid") ||
    normalized.includes("done") ||
    normalized.includes("closed") ||
    normalized.includes("accept") ||
    normalized.includes("оплачен") ||
    normalized.includes("готов")
  ) {
    return "bg-green-500/15 text-green-400 ring-green-500/30";
  }

  if (normalized.includes("cancel") || normalized.includes("отмен")) {
    return "bg-red-500/15 text-red-400 ring-red-500/30";
  }

  if (
    normalized.includes("sent") ||
    normalized.includes("progress") ||
    normalized.includes("work") ||
    normalized.includes("в работе") ||
    normalized.includes("отправ")
  ) {
    return "bg-blue-500/15 text-blue-400 ring-blue-500/30";
  }

  return "bg-zinc-800 text-zinc-300 ring-zinc-700";
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClientCard() {
      setLoading(true);
      setErrorMessage("");

      const clientResult = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (!active) return;

      if (clientResult.error || !clientResult.data) {
        setErrorMessage(clientResult.error?.message || "Клиент не найден.");
        setLoading(false);
        return;
      }

      const [vehiclesResult, ordersResult] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, brand, model, plate, vin, year, mileage")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),

        supabase
          .from("work_orders")
          .select(
            "id, order_number, created_at, status, total_amount, paid_amount, vehicle_id, vehicles(id, brand, model, plate, vin, year, mileage)"
          )
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      const normalizedOrders: WorkOrder[] = (
        (ordersResult.data || []) as WorkOrderRow[]
      ).map(({ vehicles: relation, ...order }) => ({
        ...order,
        vehicle: normalizeVehicle(relation),
      }));

      const orderIds = normalizedOrders.map((order) => order.id);

      const emptyResult = Promise.resolve<QueryResult<never>>({
        data: [],
        error: null,
      });

      const [devisResult, facturesResult, paymentsResult, appointmentsResult] =
        await Promise.all([
          orderIds.length
            ? supabase
                .from("devis")
                .select(
                  "id, devis_number, work_order_id, created_at, status, total_ttc, seller, lang"
                )
                .in("work_order_id", orderIds)
                .order("created_at", { ascending: false })
            : emptyResult,

          orderIds.length
            ? supabase
                .from("factures")
                .select(
                  "id, facture_number, work_order_id, created_at, status, total_ttc, seller, lang"
                )
                .in("work_order_id", orderIds)
                .order("created_at", { ascending: false })
            : emptyResult,

          orderIds.length
            ? supabase
                .from("work_order_payments")
                .select(
                  "id, work_order_id, amount, payment_method, payment_date, note"
                )
                .in("work_order_id", orderIds)
                .order("payment_date", { ascending: false })
            : emptyResult,

          supabase
            .from("appointments")
            .select(
              "id, appointment_date, start_time, title, status, vehicle_id"
            )
            .eq("client_id", id)
            .order("appointment_date", { ascending: true }),
        ]);

      if (!active) return;

      const errors = [
        vehiclesResult.error,
        ordersResult.error,
        devisResult.error,
        facturesResult.error,
        paymentsResult.error,
        appointmentsResult.error,
      ].filter((error): error is { message: string } => Boolean(error));

      if (errors.length) {
        setErrorMessage(errors.map((error) => error.message).join("\n"));
      }

      setClient(clientResult.data as Client);
      setVehicles((vehiclesResult.data || []) as Vehicle[]);
      setOrders(normalizedOrders);
      setDevis((devisResult.data || []) as Devis[]);
      setFactures((facturesResult.data || []) as Facture[]);
      setPayments((paymentsResult.data || []) as Payment[]);
      setAppointments((appointmentsResult.data || []) as Appointment[]);
      setLoading(false);
    }

    void loadClientCard();

    return () => {
      active = false;
    };
  }, [id]);

  const totals = useMemo(() => {
    const turnover = orders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );

    const paid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    return {
      turnover,
      paid,
      debt: Math.max(0, turnover - paid),
      average: orders.length ? turnover / orders.length : 0,
    };
  }, [orders, payments]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return appointments
      .filter(
        (appointment) =>
          appointment.appointment_date >= today &&
          appointment.status !== "cancelled"
      )
      .slice(0, 5);
  }, [appointments]);

  const ownerName =
    client?.client_type === "societe"
      ? client.company_name || client.full_name
      : client?.full_name;

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-green-500" />
            <p className="mt-4 text-sm text-zinc-400">
              Загрузка карточки клиента...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-green-400"
        >
          <ChevronLeft size={17} />
          Назад к клиентам
        </Link>

        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-5 text-red-300">
          {errorMessage || "Клиент не найден."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-green-400"
      >
        <ChevronLeft size={17} />
        Назад к клиентам
      </Link>

      <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <UserRound size={24} />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-green-400 sm:text-3xl">
              {ownerName || "Клиент"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {client.client_type === "societe"
                ? `Société · контакт: ${client.full_name || "-"}`
                : "Particulier"}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:flex">
          <Link
            href={`/clients/${client.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold hover:bg-blue-500"
          >
            Изменить клиента
          </Link>

          <Link
            href={`/vehicles/new?clientId=${client.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-3 text-sm font-bold hover:bg-zinc-700"
          >
            <Car size={17} />
            Добавить автомобиль
          </Link>

          <Link
            href={`/work-orders/new?clientId=${client.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-black hover:bg-green-400"
          >
            <Plus size={17} />
            Новый заказ
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 whitespace-pre-wrap rounded-xl border border-yellow-900 bg-yellow-950/30 p-4 text-sm text-yellow-300">
          Некоторые данные не загрузились: {errorMessage}
        </div>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric title="Автомобилей" value={String(vehicles.length)} />
        <Metric title="Визитов" value={String(orders.length)} />
        <Metric title="Оборот" value={money(totals.turnover)} />
        <Metric
          title="Оплачено"
          value={money(totals.paid)}
          accent="text-green-400"
        />
        <Metric
          title="Задолженность"
          value={money(totals.debt)}
          accent="text-orange-400"
        />
        <Metric title="Средний чек" value={money(totals.average)} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Section
            title="Автомобили"
            icon={Car}
            action={
              <Link
                href={`/vehicles/new?clientId=${client.id}`}
                className="text-sm font-semibold text-green-400 hover:text-green-300"
              >
                + Добавить
              </Link>
            }
          >
            {vehicles.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {vehicles.map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-green-500"
                  >
                    <p className="font-bold text-green-400">
                      {vehicle.brand || "-"} {vehicle.model || ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {vehicle.plate || "Без номера"} ·{" "}
                      {mileage(vehicle.mileage)}
                    </p>
                    <p className="mt-1 break-all text-xs text-zinc-600">
                      VIN: {vehicle.vin || "-"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty text="У клиента пока нет автомобилей." />
            )}
          </Section>

          <Section title="История заказов" icon={ClipboardList}>
            {orders.length ? (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/work-orders/${order.id}`}
                    className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-green-500 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-green-400">
                          {order.order_number || "Заказ без номера"}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(
                            order.status
                          )}`}
                        >
                          {order.status || "Без статуса"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-zinc-400">
                        {formatDate(order.created_at)} ·{" "}
                        {order.vehicle
                          ? `${order.vehicle.brand || ""} ${
                              order.vehicle.model || ""
                            } ${order.vehicle.plate || ""}`
                          : "Автомобиль не указан"}
                      </p>
                    </div>

                    <p className="font-bold sm:text-right">
                      {money(order.total_amount)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty text="Заказ-нарядов пока нет." />
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <DocumentList
              title="Devis"
              icon={FileText}
              documents={devis}
              type="devis"
              colorClass="text-blue-400"
            />

            <DocumentList
              title="Factures"
              icon={ReceiptText}
              documents={factures}
              type="facture"
              colorClass="text-purple-400"
            />
          </div>

          <Section title="История оплат" icon={CreditCard}>
            {payments.length ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <Link
                    key={payment.id}
                    href={`/work-orders/${payment.work_order_id}`}
                    className="grid gap-2 rounded-lg bg-zinc-950 p-3 sm:grid-cols-[120px_1fr_auto]"
                  >
                    <span className="text-sm text-zinc-500">
                      {formatDate(payment.payment_date)}
                    </span>
                    <span className="text-sm">
                      {payment.payment_method || "Способ не указан"}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </span>
                    <b className="text-green-400">{money(payment.amount)}</b>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty text="Оплат пока нет." />
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <ClientCommunications
            clientId={client.id}
            clientName={ownerName || client.full_name}
            phone={client.phone}
            vehicleLabel={
              vehicles[0]
                ? `${vehicles[0].brand || ""} ${vehicles[0].model || ""} ${vehicles[0].plate || ""}`.trim()
                : ""
            }
            appointmentDate={upcomingAppointments[0]?.appointment_date || ""}
            appointmentTime={upcomingAppointments[0]?.start_time?.slice(0, 5) || ""}
          />
          <Section title="Контакты" icon={UserRound}>
            <div className="space-y-3">
              <ContactRow
                icon={Phone}
                label="Телефон"
                value={client.phone}
                href={client.phone ? `tel:${client.phone}` : undefined}
              />
              <ContactRow
                icon={Mail}
                label="Email"
                value={client.email}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <ContactRow
                icon={MapPin}
                label="Адрес"
                value={client.address}
              />

              {client.client_type === "societe" && (
                <>
                  <InfoRow label="SIREN" value={client.siren} />
                  <InfoRow label="SIRET" value={client.siret} />
                  <InfoRow label="TVA" value={client.vat_number} />
                  <InfoRow
                    label="Адрес фактуры"
                    value={client.billing_address}
                  />
                  <InfoRow
                    label="Адрес доставки"
                    value={client.delivery_address}
                  />
                </>
              )}
            </div>
          </Section>

          <Section title="Следующие записи" icon={CalendarDays}>
            {upcomingAppointments.length ? (
              <div className="space-y-3">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-lg bg-zinc-950 p-3"
                  >
                    <p className="font-semibold text-green-400">
                      {formatDate(appointment.appointment_date)} ·{" "}
                      {appointment.start_time?.slice(0, 5)}
                    </p>
                    <p className="mt-1 text-sm">{appointment.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {appointment.status || "planned"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Будущих записей нет." />
            )}

            <Link
              href="/calendar"
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-800 px-4 py-3 text-sm font-bold hover:bg-zinc-700"
            >
              Открыть календарь
            </Link>
          </Section>

          <Section title="Примечания" icon={FileText}>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {client.notes || "Примечаний нет."}
            </p>
          </Section>

          <Section title="Карточка клиента" icon={UserRound}>
            <InfoRow label="Создан" value={formatDate(client.created_at)} />
            <InfoRow
              label="Тип"
              value={
                client.client_type === "societe"
                  ? "Société"
                  : "Particulier"
              }
            />
            <InfoRow label="ID" value={client.id} />
          </Section>
        </aside>
      </section>
    </main>
  );
}

function DocumentList({
  title,
  icon,
  documents,
  type,
  colorClass,
}: {
  title: string;
  icon: LucideIcon;
  documents: Array<Devis | Facture>;
  type: "devis" | "facture";
  colorClass: string;
}) {
  return (
    <Section title={title} icon={icon}>
      {documents.length ? (
        <div className="space-y-2">
          {documents.slice(0, 8).map((document) => {
            const number =
              "devis_number" in document
                ? document.devis_number
                : document.facture_number;

            return (
              <Link
                key={document.id}
                href={`/work-orders/${
                  document.work_order_id
                }/documents/${type}/${document.lang || "fr"}?seller=${
                  document.seller || "srvauto"
                }&documentId=${document.id}`}
                target="_blank"
                className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 p-3 hover:ring-1 hover:ring-zinc-700"
              >
                <div className="min-w-0">
                  <p className={`truncate font-semibold ${colorClass}`}>
                    {number || title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(document.created_at)} ·{" "}
                    {document.status || "draft"}
                  </p>
                </div>
                <b>{money(document.total_ttc)}</b>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty text={`${title} пока нет.`} />
      )}
    </Section>
  );
}

function Metric({
  title,
  value,
  accent = "text-white",
}: {
  title: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className={`mt-2 text-xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-green-400">
          <Icon size={18} />
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const content = (
    <div className="flex gap-3">
      <Icon size={17} className="mt-0.5 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="break-words text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block rounded-lg p-2 hover:bg-zinc-950">
      {content}
    </a>
  ) : (
    <div className="rounded-lg p-2">{content}</div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-800 py-2.5 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <b className="max-w-[65%] break-words text-right text-sm">
        {String(value || "-")}
      </b>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-zinc-500">{text}</p>;
}