"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function WorkOrderChecklist({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const [loading, setLoading] = useState(true);

  const [fuelLevel, setFuelLevel] = useState("");
  const [vehicleCondition, setVehicleCondition] = useState("");
  const [personalItems, setPersonalItems] = useState("");

  const [registrationCard, setRegistrationCard] = useState(false);
  const [lockingWheelNut, setLockingWheelNut] = useState(false);
  const [serviceBook, setServiceBook] = useState(false);
  const [warningLights, setWarningLights] = useState(false);
  const [visibleDamage, setVisibleDamage] = useState(false);

  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadChecklist();
  }, []);

  async function loadChecklist() {
    const { data } = await supabase
      .from("work_order_checklists")
      .select("*")
      .eq("work_order_id", workOrderId)
      .maybeSingle();

    if (data) {
      setFuelLevel(data.fuel_level || "");
      setVehicleCondition(data.vehicle_condition || "");
      setPersonalItems(data.personal_items || "");

      setRegistrationCard(data.has_registration_card);
      setLockingWheelNut(data.has_locking_wheel_nut);
      setServiceBook(data.has_service_book);
      setWarningLights(data.has_warning_lights);
      setVisibleDamage(data.has_visible_damage);

      setNotes(data.notes || "");
    }

    setLoading(false);
  }

  async function saveChecklist() {
    const payload = {
      work_order_id: workOrderId,

      fuel_level: fuelLevel,
      vehicle_condition: vehicleCondition,
      personal_items: personalItems,

      has_registration_card: registrationCard,
      has_locking_wheel_nut: lockingWheelNut,
      has_service_book: serviceBook,
      has_warning_lights: warningLights,
      has_visible_damage: visibleDamage,

      notes,
    };

    const { data } = await supabase
      .from("work_order_checklists")
      .select("id")
      .eq("work_order_id", workOrderId)
      .maybeSingle();

    if (data) {
      await supabase
        .from("work_order_checklists")
        .update(payload)
        .eq("id", data.id);
    } else {
      await supabase
        .from("work_order_checklists")
        .insert(payload);
    }

    alert("Приёмка сохранена");
  }

  if (loading) return null;

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-bold text-green-400">
        Приёмка автомобиля
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <select
          className="rounded bg-zinc-950 p-3"
          value={fuelLevel}
          onChange={(e) => setFuelLevel(e.target.value)}
        >
          <option value="">Топливо</option>
          <option>Пусто</option>
          <option>1/4</option>
          <option>1/2</option>
          <option>3/4</option>
          <option>Полный</option>
        </select>

        <select
          className="rounded bg-zinc-950 p-3"
          value={vehicleCondition}
          onChange={(e) => setVehicleCondition(e.target.value)}
        >
          <option value="">Состояние</option>
          <option>Чистый</option>
          <option>Средний</option>
          <option>Грязный</option>
        </select>

        <input
          className="rounded bg-zinc-950 p-3"
          placeholder="Личные вещи"
          value={personalItems}
          onChange={(e) => setPersonalItems(e.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <label><input type="checkbox" checked={registrationCard} onChange={(e)=>setRegistrationCard(e.target.checked)} /> Техпаспорт передан</label>

        <label><input type="checkbox" checked={lockingWheelNut} onChange={(e)=>setLockingWheelNut(e.target.checked)} /> Секретка колёс</label>

        <label><input type="checkbox" checked={serviceBook} onChange={(e)=>setServiceBook(e.target.checked)} /> Сервисная книжка</label>

        <label><input type="checkbox" checked={warningLights} onChange={(e)=>setWarningLights(e.target.checked)} /> Горят ошибки на панели</label>

        <label><input type="checkbox" checked={visibleDamage} onChange={(e)=>setVisibleDamage(e.target.checked)} /> Есть внешние повреждения</label>
      </div>

      <textarea
        className="mt-6 w-full rounded bg-zinc-950 p-3"
        rows={4}
        placeholder="Комментарий при приёмке..."
        value={notes}
        onChange={(e)=>setNotes(e.target.value)}
      />

      <button
        onClick={saveChecklist}
        className="mt-6 rounded bg-green-500 px-6 py-3 font-bold text-black"
      >
        Сохранить приёмку
      </button>
    </div>
  );
}