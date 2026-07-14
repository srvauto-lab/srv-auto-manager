"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Photo = {
  id: string;
  photo_url: string;
  storage_path: string | null;
  category: string | null;
  notes: string | null;
};

const bucketName = "work-order-photos";

const requiredPhotos = [
  { key: "front", label: "Перед автомобиля" },
  { key: "rear", label: "Зад автомобиля" },
  { key: "left", label: "Левая сторона" },
  { key: "right", label: "Правая сторона" },
  { key: "interior", label: "Салон" },
  { key: "mileage", label: "Пробег" },
  { key: "vin", label: "VIN" },
];

const extraCategories = [
  { key: "damage", label: "Повреждения" },
  { key: "repair", label: "В процессе ремонта" },
  { key: "after", label: "После ремонта" },
  { key: "documents", label: "Документы" },
  { key: "other", label: "Дополнительно" },
];

export default function WorkOrderPhotos({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [extraCategory, setExtraCategory] = useState("damage");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setPhotos(data || []);
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  const completedRequired = useMemo(() => {
    return requiredPhotos.filter((item) =>
      photos.some((photo) => photo.category === item.key)
    ).length;
  }, [photos]);

  function getPhotoByCategory(category: string) {
    return photos.find((photo) => photo.category === category);
  }

  async function uploadFile(file: File, category: string, customNotes = "") {
    const fileExt = file.name.split(".").pop();
    const filePath = `${workOrderId}/${category}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    const { error: insertError } = await supabase
      .from("work_order_photos")
      .insert({
        work_order_id: workOrderId,
        photo_url: data.publicUrl,
        storage_path: filePath,
        category,
        notes: customNotes,
      });

    if (insertError) throw insertError;
  }

  async function uploadRequiredPhoto(category: string, files: FileList | null) {
    if (!files?.[0]) return;

    setUploading(true);

    try {
      const existing = getPhotoByCategory(category);

      if (existing) {
        await deletePhoto(existing, false);
      }

      await uploadFile(files[0], category);
      await loadPhotos();
    } catch (error: any) {
      alert(error.message);
    }

    setUploading(false);
  }

  async function uploadExtraPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        await uploadFile(file, extraCategory, notes);
      }

      setNotes("");
      await loadPhotos();
    } catch (error: any) {
      alert(error.message);
    }

    setUploading(false);
  }

  async function deletePhoto(photo: Photo, reload = true) {
    if (reload && !confirm("Удалить фото?")) return;

    if (photo.storage_path) {
      await supabase.storage.from(bucketName).remove([photo.storage_path]);
    }

    const { error } = await supabase
      .from("work_order_photos")
      .delete()
      .eq("id", photo.id);

    if (error) alert(error.message);
    else if (reload) await loadPhotos();
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">Фото автомобиля</h2>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <p className="font-bold">
          Приёмка: {completedRequired} / {requiredPhotos.length}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Обязательные фотографии автомобиля при приёмке.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requiredPhotos.map((item) => {
          const photo = getPhotoByCategory(item.key);

          return (
            <div
              key={item.key}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <p className="font-bold text-green-400">{item.label}</p>

              {photo ? (
                <div className="mt-3">
                  <a href={photo.photo_url} target="_blank">
                    <img
                      src={photo.photo_url}
                      alt={item.label}
                      className="h-40 w-full rounded object-cover"
                    />
                  </a>

                  <button
                    type="button"
                    onClick={() => deletePhoto(photo)}
                    className="mt-3 rounded bg-red-600 px-3 py-2 text-xs font-bold"
                  >
                    Удалить
                  </button>
                </div>
              ) : (
                <label className="mt-3 block cursor-pointer rounded border border-dashed border-zinc-700 p-5 text-center hover:border-green-500">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      uploadRequiredPhoto(item.key, e.target.files)
                    }
                  />
                  <span className="text-sm font-bold text-zinc-300">
                    📷 Сделать фото
                  </span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h3 className="font-bold text-green-400">Дополнительные фото</h3>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select
            className="rounded bg-zinc-900 p-3"
            value={extraCategory}
            onChange={(e) => setExtraCategory(e.target.value)}
          >
            {extraCategories.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>

          <input
            className="rounded bg-zinc-900 p-3"
            placeholder="Комментарий"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <label className="mt-4 block cursor-pointer rounded-lg border border-dashed border-zinc-700 p-6 text-center hover:border-green-500">
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => uploadExtraPhotos(e.target.files)}
          />
          <span className="font-bold text-green-400">
            {uploading ? "Загружаем..." : "Добавить фото"}
          </span>
          <p className="mt-2 text-sm text-zinc-400">
            Можно выбрать или сделать сразу несколько фото
          </p>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {photos
          .filter(
            (photo) =>
              !requiredPhotos.some((item) => item.key === photo.category)
          )
          .map((photo) => (
            <div
              key={photo.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            >
              <a href={photo.photo_url} target="_blank">
                <img
                  src={photo.photo_url}
                  alt={photo.notes || "Фото"}
                  className="h-40 w-full rounded object-cover"
                />
              </a>

              <p className="mt-2 text-sm text-green-400">
                {extraCategories.find((c) => c.key === photo.category)
                  ?.label || photo.category}
              </p>

              <p className="text-sm text-zinc-400">{photo.notes || "-"}</p>

              <button
                type="button"
                onClick={() => deletePhoto(photo)}
                className="mt-3 rounded bg-red-600 px-3 py-2 text-xs font-bold"
              >
                Удалить
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}