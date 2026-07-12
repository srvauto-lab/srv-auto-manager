"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type SignatureRecord = {
  id: string;
  work_order_id: string;
  signature_type: string;
  signer_name: string | null;
  signature_url: string;
  storage_path: string | null;
  signed_at: string;
};

const BUCKET_NAME = "work-order-signatures";
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 400;

export default function WorkOrderSignature({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);

  const [signature, setSignature] = useState<SignatureRecord | null>(null);
  const [signatureType, setSignatureType] = useState("reception");
  const [signerName, setSignerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSignature();
  }, [workOrderId, signatureType]);

  useEffect(() => {
    if (!loading && !signature) {
      requestAnimationFrame(() => prepareCanvas());
    }
  }, [loading, signature, signatureType]);

  async function loadSignature() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_order_signatures")
      .select("*")
      .eq("work_order_id", workOrderId)
      .eq("signature_type", signatureType)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSignature(data || null);
    setSignerName(data?.signer_name || "");
    drawingRef.current = false;
    hasDrawingRef.current = false;
    setLoading(false);
  }

  function configureContext(context: CanvasRenderingContext2D) {
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }

  function prepareCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || signature) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    configureContext(context);

    drawingRef.current = false;
    hasDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    configureContext(context);

    drawingRef.current = false;
    hasDrawingRef.current = false;
  }

  function getPointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || signature || saving) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    const context = canvas.getContext("2d");
    if (!context) return;

    configureContext(context);
    const position = getPointerPosition(event);

    drawingRef.current = true;
    hasDrawingRef.current = true;

    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineTo(position.x + 0.1, position.y + 0.1);
    context.stroke();
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || signature || saving) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const position = getPointerPosition(event);
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    drawingRef.current = false;
  }

  function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Не удалось создать файл подписи."));
      }, "image/png");
    });
  }

  async function saveSignature() {
    if (!signerName.trim()) {
      alert("Укажи имя клиента.");
      return;
    }

    if (!hasDrawingRef.current) {
      alert("Клиент ещё не поставил подпись.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      alert("Поле подписи не найдено.");
      return;
    }

    setSaving(true);

    try {
      const blob = await canvasToBlob(canvas);
      const storagePath = `${workOrderId}/${signatureType}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, blob, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      const payload = {
        work_order_id: workOrderId,
        signature_type: signatureType,
        signer_name: signerName.trim(),
        signature_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        signed_at: new Date().toISOString(),
      };

      const { error: databaseError } = await supabase
        .from("work_order_signatures")
        .upsert(payload, {
          onConflict: "work_order_id,signature_type",
        });

      if (databaseError) {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw databaseError;
      }

      await loadSignature();
    } catch (error: any) {
      alert(error?.message || "Не удалось сохранить подпись.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSignature() {
    if (!signature) return;
    if (!confirm("Удалить подпись клиента?")) return;

    setSaving(true);

    try {
      if (signature.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([signature.storage_path]);

        if (storageError) throw storageError;
      }

      const { error: databaseError } = await supabase
        .from("work_order_signatures")
        .delete()
        .eq("id", signature.id);

      if (databaseError) throw databaseError;

      setSignature(null);
      setSignerName("");
      drawingRef.current = false;
      hasDrawingRef.current = false;
      requestAnimationFrame(() => prepareCanvas());
    } catch (error: any) {
      alert(error?.message || "Не удалось удалить подпись.");
    } finally {
      setSaving(false);
    }
  }

  const signatureTypeLabel =
    signatureType === "delivery"
      ? "Подпись при выдаче автомобиля"
      : "Подпись при приёмке автомобиля";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-green-400">Подпись клиента</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Клиент может подписать пальцем на телефоне или мышкой на компьютере.
          </p>
        </div>

        <select
          className="rounded-lg border border-zinc-700 bg-zinc-950 p-3"
          value={signatureType}
          onChange={(event) => setSignatureType(event.target.value)}
          disabled={saving}
        >
          <option value="reception">Приёмка автомобиля</option>
          <option value="delivery">Выдача автомобиля</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-zinc-400">Загрузка подписи...</p>
      ) : signature ? (
        <div className="mt-6">
          <div className="rounded-xl border border-zinc-800 bg-white p-4">
            <img
              src={signature.signature_url}
              alt={signatureTypeLabel}
              className="mx-auto max-h-64 w-full object-contain"
            />
          </div>

          <div className="mt-4 rounded-lg bg-zinc-950 p-4 text-sm">
            <p>
              Клиент: <span className="font-bold text-white">{signature.signer_name || "-"}</span>
            </p>
            <p className="mt-1 text-zinc-400">Тип: {signatureTypeLabel}</p>
            <p className="mt-1 text-zinc-400">
              Дата: {new Date(signature.signed_at).toLocaleString("fr-FR")}
            </p>
          </div>

          <button
            type="button"
            onClick={deleteSignature}
            disabled={saving}
            className="mt-4 rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {saving ? "Удаляем..." : "Удалить подпись"}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <input
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            placeholder="Имя и фамилия клиента"
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
          />

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700 bg-white">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-64 w-full touch-none cursor-crosshair select-none"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </div>

          <p className="mt-2 text-sm text-zinc-400">
            Подпишите внутри белого поля. Линия должна появляться точно под пальцем или курсором.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearCanvas}
              disabled={saving}
              className="rounded-lg bg-zinc-700 px-5 py-3 font-bold hover:bg-zinc-600 disabled:opacity-50"
            >
              Очистить
            </button>

            <button
              type="button"
              onClick={saveSignature}
              disabled={saving}
              className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400 disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : "Сохранить подпись"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}