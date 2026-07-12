"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Recommendation = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_mileage: string | null;
  due_date: string | null;
};

export default function VehicleRecommendations({
  vehicleId,
  recommendations,
}: {
  vehicleId: string;
  recommendations: Recommendation[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueMileage, setDueMileage] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function addRecommendation(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("vehicle_recommendations").insert({
      vehicle_id: vehicleId,
      title,
      description,
      due_mileage: dueMileage,
      due_date: dueDate || null,
      status: "open",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setDueMileage("");
    setDueDate("");

    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("vehicle_recommendations")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  async function deleteRecommendation(id: string) {
    if (!confirm("Удалить рекомендацию?")) return;

    const { error } = await supabase
      .from("vehicle_recommendations")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">
        Рекомендации по автомобилю
      </h2>

      <form onSubmit={addRecommendation} className="mt-5 space-y-4">
        <input
          className="w-full rounded bg-zinc-950 p-3"
          placeholder="Например: заменить передние колодки"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="w-full rounded bg-zinc-950 p-3"
          placeholder="Комментарий"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="rounded bg-zinc-950 p-3"
            placeholder="До пробега, например 185000"
            value={dueMileage}
            onChange={(e) => setDueMileage(e.target.value)}
          />

          <input
            className="rounded bg-zinc-950 p-3"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <button className="rounded bg-green-500 px-5 py-3 font-bold text-black">
          Добавить рекомендацию
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {recommendations.length ? (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-green-400">{rec.title}</p>
                  {rec.description && (
                    <p className="mt-1 text-sm text-zinc-300">
                      {rec.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-zinc-400">
                    До пробега: {rec.due_mileage || "-"} · Дата:{" "}
                    {rec.due_date || "-"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <select
                    className="rounded bg-zinc-900 px-3 py-2 text-sm"
                    value={rec.status}
                    onChange={(e) => updateStatus(rec.id, e.target.value)}
                  >
                    <option value="open">open</option>
                    <option value="done">done</option>
                    <option value="cancelled">cancelled</option>
                  </select>

                  <button
                    onClick={() => deleteRecommendation(rec.id)}
                    className="rounded bg-red-600 px-3 py-2 text-sm font-bold"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-zinc-400">Рекомендаций пока нет.</p>
        )}
      </div>
    </div>
  );
}