"use client";

import Link from "next/link";
import { useMemo } from "react";

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  description: string | null;
  mechanic: string | null;
  lift: string | null;
  status: string;
  work_order_id: string | null;
  clients?: any;
  vehicles?: any;
};

const lifts = ["Пост №1", "Пост №2", "Пост №3", "Пост приёмки / диагностики"];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function CalendarBoard({
  selectedDate,
  appointments,
  onDelete,
  onAdd,
  onEdit,
  onCreateWorkOrder,
}: {
  selectedDate: string;
  appointments: Appointment[];
  onDelete: (id: string) => void;
  onAdd: (date: string, lift: string) => void;
  onEdit: (appointment: Appointment) => void;
  onCreateWorkOrder: (appointmentId: string) => void;
}) {
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    return Array.from({ length: 7 }).map((_, index) => addDays(start, index));
  }, [selectedDate]);

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">
        Неделя с {new Date(selectedDate).toLocaleDateString("fr-FR")}
      </h2>

      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[1400px] grid-cols-8 border-b border-zinc-800 text-sm font-bold text-zinc-400">
          <div className="p-3">Пост / день</div>
          {weekDays.map((day) => (
            <div key={toDateString(day)} className="p-3">
              {day.toLocaleDateString("ru-RU", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              })}
            </div>
          ))}
        </div>

        {lifts.map((lift) => (
          <div
            key={lift}
            className="grid min-w-[1400px] grid-cols-8 border-b border-zinc-800"
          >
            <div className="bg-zinc-950 p-3 font-bold text-green-400">
              {lift}
            </div>

            {weekDays.map((day) => {
              const dateKey = toDateString(day);

              const dayAppointments = appointments.filter(
                (a) => a.appointment_date === dateKey && a.lift === lift
              );

              return (
                <div
                  key={`${lift}-${dateKey}`}
                  className="min-h-40 border-l border-zinc-800 p-2"
                >
                  <button
                    type="button"
                    onClick={() => onAdd(dateKey, lift)}
                    className="mb-2 rounded bg-green-500 px-2 py-1 text-xs font-bold text-black"
                  >
                    + Добавить
                  </button>

                  {dayAppointments.length ? (
                    <div className="space-y-2">
                      {dayAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 p-3"
                        >
                          <p className="font-bold text-green-400">
                            {appointment.start_time?.slice(0, 5)}
                            {appointment.end_time
                              ? `–${appointment.end_time.slice(0, 5)}`
                              : ""}{" "}
                            · {appointment.title}
                          </p>

                          <p className="mt-1 text-xs text-zinc-300">
                            {appointment.clients?.client_type === "societe"
                              ? appointment.clients?.company_name ||
                                appointment.clients?.full_name
                              : appointment.clients?.full_name ||
                                "Клиент не указан"}
                          </p>

                          <p className="text-xs text-zinc-400">
                            {appointment.vehicles
                              ? `${appointment.vehicles.brand} ${
                                  appointment.vehicles.model
                                } ${appointment.vehicles.plate || ""}`
                              : "Автомобиль не указан"}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Механик: {appointment.mechanic || "-"} ·{" "}
                            {appointment.status}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(appointment)}
                              className="rounded bg-zinc-700 px-2 py-1 text-xs font-bold hover:bg-zinc-600"
                            >
                              Изменить
                            </button>

                            {appointment.work_order_id ? (
                              <Link
                                href={`/work-orders/${appointment.work_order_id}`}
                                className="rounded bg-blue-600 px-2 py-1 text-xs font-bold"
                              >
                                Открыть ЗН
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onCreateWorkOrder(appointment.id)
                                }
                                className="rounded bg-green-600 px-2 py-1 text-xs font-bold"
                              >
                                Клиент приехал
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onDelete(appointment.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-bold"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">Свободно</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}