"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CalendarBoard from "@/components/calendar/CalendarBoard";
import AppointmentModal from "@/components/calendar/AppointmentModal";
import EditAppointmentModal from "@/components/calendar/EditAppointmentModal";
import { useAppSettings } from "@/hooks/useAppSettings";

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

type MechanicOption = {
  id: string;
  name: string;
  role: string;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  description: string | null;
  mechanic: string | null;
  mechanic_id?: string | null;
  lift: string | null;
  status: string;
  work_order_id: string | null;
  client_id?: string | null;
  vehicle_id?: string | null;
  clients?: Client | null;
  vehicles?: Vehicle | null;
};

export default function CalendarPage() {
  const { settings } = useAppSettings();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<MechanicOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(today);
  const [modalLift, setModalLift] = useState("");

  const [editAppointment, setEditAppointment] = useState<Appointment | null>(
    null
  );

  function weekEnd(startDate: string) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  async function loadData() {
    const [appointmentsRes, clientsRes, vehiclesRes, mechanicsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "*, clients(id, full_name, company_name, client_type, phone), vehicles(id, client_id, brand, model, plate)"
        )
        .gte("appointment_date", date)
        .lte("appointment_date", weekEnd(date))
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true }),

      supabase
        .from("clients")
        .select("id, full_name, company_name, client_type, phone")
        .order("full_name"),

      supabase
        .from("vehicles")
        .select("id, client_id, brand, model, plate")
        .order("created_at", { ascending: false }),

      fetch("/api/calendar/mechanics", { cache: "no-store" }).then(async (response) => ({
        ok: response.ok,
        data: await response.json(),
      })),
    ]);

    if (appointmentsRes.error) alert(appointmentsRes.error.message);
    else setAppointments(appointmentsRes.data || []);

    if (clientsRes.error) alert(clientsRes.error.message);
    else setClients(clientsRes.data || []);

    if (vehiclesRes.error) alert(vehiclesRes.error.message);
    else setVehicles(vehiclesRes.data || []);

    if (!mechanicsRes.ok) alert(mechanicsRes.data?.error || "Не удалось загрузить механиков.");
    else setMechanics(mechanicsRes.data?.mechanics || []);
  }

  useEffect(() => {
    loadData();
  }, [date]);

  async function deleteAppointment(id: string) {
    if (!confirm("Удалить запись?")) return;

    const { error } = await supabase.from("appointments").delete().eq("id", id);

    if (error) alert(error.message);
    else await loadData();
  }

  async function createWorkOrderFromAppointment(appointmentId: string) {
    const { data: appointmentFull, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, client_id, vehicle_id, title, description, work_order_id")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointmentFull) {
      alert(appointmentError?.message || "Запись не найдена");
      return;
    }

    if (appointmentFull.work_order_id) {
      window.location.href = `/work-orders/${appointmentFull.work_order_id}`;
      return;
    }

    const { data: newOrder, error } = await supabase
      .from("work_orders")
      .insert({
        client_id: appointmentFull.client_id || null,
        vehicle_id: appointmentFull.vehicle_id || null,
        mileage: "",
        customer_complaint: appointmentFull.title,
        work_description: appointmentFull.description || "",
        status: "Принят",
        labor_total: 0,
        parts_total: 0,
        total_amount: 0,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("appointments")
      .update({
        work_order_id: newOrder.id,
        status: "arrived",
      })
      .eq("id", appointmentId);

    window.location.href = `/work-orders/${newOrder.id}`;
  }

  function previousWeek() {
    const d = new Date(date);
    d.setDate(d.getDate() - 7);
    setDate(d.toISOString().slice(0, 10));
  }

  function nextWeek() {
    const d = new Date(date);
    d.setDate(d.getDate() + 7);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <main className="p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Календарь</h1>
      <p className="mt-2 text-zinc-400">Записи клиентов и загрузка гаража</p>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <button
          onClick={previousWeek}
          className="rounded bg-zinc-700 px-4 py-2 font-bold hover:bg-zinc-600"
        >
          ← Неделя
        </button>

        <input
          type="date"
          className="rounded bg-zinc-950 p-3"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <button
          onClick={() => setDate(today)}
          className="rounded bg-green-600 px-4 py-2 font-bold hover:bg-green-500"
        >
          Сегодня
        </button>

        <button
          onClick={nextWeek}
          className="rounded bg-zinc-700 px-4 py-2 font-bold hover:bg-zinc-600"
        >
          Неделя →
        </button>
      </div>

      <CalendarBoard
        selectedDate={date}
        lifts={settings.lifts}
        appointments={appointments}
        onDelete={deleteAppointment}
        onAdd={(selectedDate, selectedLift) => {
          setModalDate(selectedDate);
          setModalLift(selectedLift || settings.lifts[0] || "");
          setModalOpen(true);
        }}
        onEdit={(appointment) => setEditAppointment(appointment)}
        onCreateWorkOrder={createWorkOrderFromAppointment}
      />

      <AppointmentModal
        open={modalOpen}
        date={modalDate}
        lift={modalLift}
        clients={clients}
        vehicles={vehicles}
        lifts={settings.lifts}
        mechanics={mechanics}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />

      <EditAppointmentModal
        appointment={editAppointment}
        clients={clients}
        vehicles={vehicles}
        lifts={settings.lifts}
        mechanics={mechanics}
        onClose={() => setEditAppointment(null)}
        onSaved={loadData}
      />
    </main>
  );
}