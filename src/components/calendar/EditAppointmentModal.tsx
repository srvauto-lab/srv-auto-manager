"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string;
  company_name: string | null;
  client_type: string | null;
  phone: string | null;
};

type Vehicle = {
  id: string;
  client_id: string | null;
  brand: string;
  model: string;
  plate: string | null;
};

const lifts = [
  "Пост №1",
  "Пост №2",
  "Пост №3",
  "Пост приёмки / диагностики",
];

const mechanics = ["Сергей", "Вадим", "Роберт"];

const statuses = [
  { value: "planned", label: "Запланировано" },
  { value: "confirmed", label: "Подтверждено" },
  { value: "arrived", label: "Клиент приехал" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Готово" },
  { value: "cancelled", label: "Отменено" },
];

export default function EditAppointmentModal({
  appointment,
  clients,
  vehicles,
  onClose,
  onSaved,
}: {
  appointment: any | null;
  clients: Client[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [appointmentDate, setAppointmentDate] = useState("");
  const [lift, setLift] = useState("");
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [status, setStatus] = useState("planned");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointment) return;

    setAppointmentDate(appointment.appointment_date || "");
    setLift(appointment.lift || "Пост №1");
    setClientId(appointment.client_id || appointment.clients?.id || "");
    setVehicleId(appointment.vehicle_id || appointment.vehicles?.id || "");
    setStartTime(appointment.start_time?.slice(0, 5) || "09:00");
    setEndTime(appointment.end_time?.slice(0, 5) || "10:00");
    setTitle(appointment.title || "");
    setDescription(appointment.description || "");
    setMechanic(appointment.mechanic || "");
    setStatus(appointment.status || "planned");
  }, [appointment]);

  const filteredVehicles = useMemo(() => {
    if (!clientId) return vehicles;
    return vehicles.filter((vehicle) => vehicle.client_id === clientId);
  }, [vehicles, clientId]);

  if (!appointment) return null;

  async function hasConflict() {
    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", appointmentDate)
      .eq("lift", lift)
      .neq("id", appointment.id)
      .neq("status", "cancelled")
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (error) throw error;

    return Boolean(data?.length);
  }

  async function saveAppointment(e: React.FormEvent) {
    e.preventDefault();

    if (!appointmentDate) {
      alert("Укажи дату записи.");
      return;
    }

    if (!lift) {
      alert("Выбери пост.");
      return;
    }

    if (endTime <= startTime) {
      alert("Время окончания должно быть позже времени начала.");
      return;
    }

    setSaving(true);

    try {
      if (await hasConflict()) {
        alert("На это время и этот пост уже есть запись.");
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          appointment_date: appointmentDate,
          lift,
          client_id: clientId || null,
          vehicle_id: vehicleId || null,
          start_time: startTime,
          end_time: endTime || null,
          title: title.trim(),
          description: description.trim() || null,
          mechanic: mechanic || null,
          status,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      await onSaved();
      onClose();
    } catch (error: any) {
      alert(error?.message || "Не удалось сохранить запись.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateAppointment() {
    setSaving(true);

    try {
      const { error } = await supabase.from("appointments").insert({
        appointment_date: appointmentDate,
        lift,
        client_id: clientId || null,
        vehicle_id: vehicleId || null,
        start_time: startTime,
        end_time: endTime || null,
        title: title.trim(),
        description: description.trim() || null,
        mechanic: mechanic || null,
        status: "planned",
        work_order_id: null,
      });

      if (error) throw error;

      await onSaved();
      alert("Запись продублирована.");
    } catch (error: any) {
      alert(error?.message || "Не удалось продублировать запись.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment() {
    if (!confirm("Отменить эту запись?")) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment.id);

      if (error) throw error;

      await onSaved();
      onClose();
    } catch (error: any) {
      alert(error?.message || "Не удалось отменить запись.");
    } finally {
      setSaving(false);
    }
  }

  function openWorkOrder() {
    if (!appointment.work_order_id) return;
    window.location.href = `/work-orders/${appointment.work_order_id}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-green-400">
              Редактировать запись
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Перенос, время, пост, механик и статус
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            Закрыть
          </button>
        </div>

        <form onSubmit={saveAppointment} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            <input
              type="date"
              className="rounded bg-zinc-950 p-3"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
            />

            <input
              type="time"
              className="rounded bg-zinc-950 p-3"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />

            <input
              type="time"
              className="rounded bg-zinc-950 p-3"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />

            <select
              className="rounded bg-zinc-950 p-3"
              value={lift}
              onChange={(e) => setLift(e.target.value)}
            >
              {lifts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="rounded bg-zinc-950 p-3"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded bg-zinc-950 p-3"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setVehicleId("");
              }}
            >
              <option value="">Клиент</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_type === "societe"
                    ? client.company_name || client.full_name
                    : client.full_name}
                  {client.phone ? ` — ${client.phone}` : ""}
                </option>
              ))}
            </select>

            <select
              className="rounded bg-zinc-950 p-3"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">Автомобиль</option>
              {filteredVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model}
                  {vehicle.plate ? ` — ${vehicle.plate}` : ""}
                </option>
              ))}
            </select>
          </div>

          <input
            className="w-full rounded bg-zinc-950 p-3"
            placeholder="Причина визита"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <textarea
            className="min-h-28 w-full rounded bg-zinc-950 p-3"
            placeholder="Комментарий"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <select
            className="w-full rounded bg-zinc-950 p-3"
            value={mechanic}
            onChange={(e) => setMechanic(e.target.value)}
          >
            <option value="">Механик</option>
            {mechanics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : "Сохранить изменения"}
            </button>

            {appointment.work_order_id && (
              <button
                type="button"
                onClick={openWorkOrder}
                className="rounded bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500"
              >
                Открыть заказ-наряд
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={duplicateAppointment}
              className="rounded bg-zinc-700 px-5 py-3 font-bold hover:bg-zinc-600 disabled:opacity-50"
            >
              Дублировать
            </button>

            {status !== "cancelled" && (
              <button
                type="button"
                disabled={saving}
                onClick={cancelAppointment}
                className="rounded bg-red-700 px-5 py-3 font-bold hover:bg-red-600 disabled:opacity-50"
              >
                Отменить запись
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}