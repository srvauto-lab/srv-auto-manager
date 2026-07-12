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

const lifts = ["Пост №1", "Пост №2", "Пост №3", "Пост приёмки / диагностики"];
const mechanics = ["Сергей", "Вадим", "Роберт"];

function buildTimeOptions() {
  const times: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) continue;
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

const timeOptions = buildTimeOptions();

export default function AppointmentModal({
  open,
  date,
  lift,
  clients,
  vehicles,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  lift: string;
  clients: Client[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [vehicleMode, setVehicleMode] = useState<"existing" | "new">("existing");

  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const [newVehicleBrand, setNewVehicleBrand] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleVin, setNewVehicleVin] = useState("");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [selectedLift, setSelectedLift] = useState(lift);
  const [status, setStatus] = useState("planned");
  const [createWorkOrderNow, setCreateWorkOrderNow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelectedLift(lift);
  }, [open, lift]);

  const filteredVehicles = useMemo(() => {
    if (!clientId) return vehicles;
    return vehicles.filter((vehicle) => vehicle.client_id === clientId);
  }, [vehicles, clientId]);

  if (!open) return null;

  async function saveAppointment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (endTime <= startTime) {
      alert("Время окончания должно быть позже времени начала.");
      setSaving(false);
      return;
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", date)
      .eq("lift", selectedLift)
      .neq("status", "cancelled")
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (conflictError) {
      alert(conflictError.message);
      setSaving(false);
      return;
    }

    if (conflicts && conflicts.length > 0) {
      alert("На это время и этот пост уже есть запись.");
      setSaving(false);
      return;
    }

    let finalClientId = clientId || null;
    let finalVehicleId = vehicleId || null;

    if (clientMode === "new") {
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          client_type: "particulier",
          full_name: newClientName,
          phone: newClientPhone,
          email: newClientEmail,
        })
        .select("*")
        .single();

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      finalClientId = newClient.id;
    }

    if (vehicleMode === "new") {
      const { data: newVehicle, error } = await supabase
        .from("vehicles")
        .insert({
          client_id: finalClientId,
          brand: newVehicleBrand,
          model: newVehicleModel,
          plate: newVehiclePlate,
          vin: newVehicleVin,
        })
        .select("*")
        .single();

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      finalVehicleId = newVehicle.id;
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        client_id: finalClientId,
        vehicle_id: finalVehicleId,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        title,
        description,
        mechanic,
        lift: selectedLift,
        status: createWorkOrderNow ? "arrived" : status,
        new_client_name: newClientName,
        new_client_phone: newClientPhone,
        new_client_email: newClientEmail,
        new_vehicle_brand: newVehicleBrand,
        new_vehicle_model: newVehicleModel,
        new_vehicle_plate: newVehiclePlate,
        new_vehicle_vin: newVehicleVin,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    if (createWorkOrderNow) {
      const { data: newOrder, error: orderError } = await supabase
        .from("work_orders")
        .insert({
          client_id: finalClientId,
          vehicle_id: finalVehicleId,
          mileage: "",
          customer_complaint: title,
          work_description: description || "",
          status: "Принят",
          labor_total: 0,
          parts_total: 0,
          total_amount: 0,
        })
        .select("*")
        .single();

      if (orderError) {
        alert(orderError.message);
        setSaving(false);
        return;
      }

      await supabase
        .from("appointments")
        .update({ work_order_id: newOrder.id })
        .eq("id", appointment.id);

      window.location.href = `/work-orders/${newOrder.id}`;
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-green-400">Добавить запись</h2>
            <p className="mt-1 text-sm text-zinc-400">{date} · {selectedLift}</p>
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
          <div className="grid gap-4 md:grid-cols-4">
            <select className="rounded bg-zinc-950 p-3" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>

            <select className="rounded bg-zinc-950 p-3" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>

            <select className="rounded bg-zinc-950 p-3" value={selectedLift} onChange={(e) => setSelectedLift(e.target.value)}>
              {lifts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select className="rounded bg-zinc-950 p-3" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="planned">Запланировано</option>
              <option value="confirmed">Подтверждено</option>
              <option value="arrived">Клиент приехал</option>
              <option value="in_progress">В работе</option>
              <option value="done">Готово</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setClientMode("existing")} className={`rounded px-4 py-2 ${clientMode === "existing" ? "bg-green-500 text-black" : "bg-zinc-800"}`}>
                Существующий клиент
              </button>
              <button type="button" onClick={() => setClientMode("new")} className={`rounded px-4 py-2 ${clientMode === "new" ? "bg-green-500 text-black" : "bg-zinc-800"}`}>
                Новый клиент
              </button>
            </div>

            {clientMode === "existing" ? (
              <select
                className="mt-4 w-full rounded bg-zinc-900 p-3"
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
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input className="rounded bg-zinc-900 p-3" placeholder="Имя клиента *" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required={clientMode === "new"} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Телефон" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setVehicleMode("existing")} className={`rounded px-4 py-2 ${vehicleMode === "existing" ? "bg-green-500 text-black" : "bg-zinc-800"}`}>
                Автомобиль из базы
              </button>
              <button type="button" onClick={() => setVehicleMode("new")} className={`rounded px-4 py-2 ${vehicleMode === "new" ? "bg-green-500 text-black" : "bg-zinc-800"}`}>
                Новый автомобиль
              </button>
            </div>

            {vehicleMode === "existing" ? (
              <select className="mt-4 w-full rounded bg-zinc-900 p-3" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Автомобиль</option>
                {filteredVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} {vehicle.plate ? `— ${vehicle.plate}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <input className="rounded bg-zinc-900 p-3" placeholder="Марка *" value={newVehicleBrand} onChange={(e) => setNewVehicleBrand(e.target.value)} required={vehicleMode === "new"} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Модель *" value={newVehicleModel} onChange={(e) => setNewVehicleModel(e.target.value)} required={vehicleMode === "new"} />
                <input className="rounded bg-zinc-900 p-3" placeholder="Госномер" value={newVehiclePlate} onChange={(e) => setNewVehiclePlate(e.target.value)} />
                <input className="rounded bg-zinc-900 p-3" placeholder="VIN" value={newVehicleVin} onChange={(e) => setNewVehicleVin(e.target.value)} />
              </div>
            )}
          </div>

          <input className="w-full rounded bg-zinc-950 p-3" placeholder="Название записи / причина визита *" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <textarea className="w-full rounded bg-zinc-950 p-3" placeholder="Комментарий" value={description} onChange={(e) => setDescription(e.target.value)} />

          <select className="w-full rounded bg-zinc-950 p-3" value={mechanic} onChange={(e) => setMechanic(e.target.value)}>
            <option value="">Механик</option>
            {mechanics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>

          <label className="flex items-center gap-3 rounded bg-zinc-950 p-3">
            <input
              type="checkbox"
              checked={createWorkOrderNow}
              onChange={(e) => setCreateWorkOrderNow(e.target.checked)}
            />
            <span>Создать заказ-наряд сразу</span>
          </label>

          <button disabled={saving} className="rounded bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50">
            {saving ? "Сохраняем..." : "Сохранить запись"}
          </button>
        </form>
      </div>
    </div>
  );
}