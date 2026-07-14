"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addHistory } from "@/lib/addHistory";
import { useAppSettings } from "@/hooks/useAppSettings";

type DocumentType = "order" | "devis" | "facture";

type LaborItem = {
  id: string;
  description: string | null;
};

type PartItem = {
  id: string;
  name: string | null;
  reference: string | null;
};

type TranslationPayload = {
  customer_complaint: string;
  notes: string;
  labor_items: Array<{
    id: string;
    description: string;
  }>;
  part_items: Array<{
    id: string;
    name: string;
    reference: string | null;
  }>;
};

type TranslationTarget =
  | { type: "complaint"; text: string }
  | { type: "notes"; text: string }
  | { type: "labor"; id: string; text: string }
  | { type: "part"; id: string; text: string };

type TranslationSegment = {
  targetIndex: number;
  segmentIndex: number;
  text: string;
};

const MAX_BATCH_ITEMS = 40;
const MAX_BATCH_CHARACTERS = 12_000;
const MAX_SEGMENT_CHARACTERS = 6_000;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitLongText(text: string, maxLength = MAX_SEGMENT_CHARACTERS) {
  if (text.length <= maxLength) return [text];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const sourceParts = paragraphs.length ? paragraphs : [text];
  const chunks: string[] = [];

  for (const paragraph of sourceParts) {
    if (paragraph.length <= maxLength) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph
      .split(/(?<=[.!?;:])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    let current = "";

    for (const sentence of sentences.length ? sentences : [paragraph]) {
      if (sentence.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = "";
        }

        for (let index = 0; index < sentence.length; index += maxLength) {
          chunks.push(sentence.slice(index, index + maxLength));
        }

        continue;
      }

      const candidate = current ? `${current} ${sentence}` : sentence;

      if (candidate.length > maxLength) {
        if (current) chunks.push(current);
        current = sentence;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);
  }

  return chunks.length ? chunks : [text];
}

function createBatches(segments: TranslationSegment[]) {
  const batches: TranslationSegment[][] = [];
  let currentBatch: TranslationSegment[] = [];
  let currentCharacters = 0;

  for (const segment of segments) {
    const segmentLength = segment.text.length;
    const wouldExceedItems = currentBatch.length >= MAX_BATCH_ITEMS;
    const wouldExceedCharacters =
      currentBatch.length > 0 &&
      currentCharacters + segmentLength > MAX_BATCH_CHARACTERS;

    if (wouldExceedItems || wouldExceedCharacters) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }

    currentBatch.push(segment);
    currentCharacters += segmentLength;
  }

  if (currentBatch.length) batches.push(currentBatch);

  return batches;
}

export default function DocumentActions({ orderId }: { orderId: string }) {
  const { settings } = useAppSettings();
  const [seller, setSeller] = useState(settings.default_seller);
  const [lang, setLang] = useState(settings.default_document_language);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSeller(settings.default_seller);
    setLang(settings.default_document_language);
  }, [settings.default_seller, settings.default_document_language]);
  const [message, setMessage] = useState("");

  async function translateBatch(texts: string[]) {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Не удалось выполнить перевод.");
    }

    if (!Array.isArray(data?.translations)) {
      throw new Error("Сервер перевода вернул неправильный ответ.");
    }

    if (data.translations.length !== texts.length) {
      throw new Error("Количество переводов не совпадает с количеством строк.");
    }

    return data.translations.map((item: unknown, index: number) => {
      const translated = normalizeText(item);
      return translated || texts[index];
    });
  }

  async function translateTargets(targets: TranslationTarget[]) {
    if (!targets.length) return new Map<number, string>();

    const segments: TranslationSegment[] = [];

    targets.forEach((target, targetIndex) => {
      const parts = splitLongText(target.text);

      parts.forEach((text, segmentIndex) => {
        segments.push({
          targetIndex,
          segmentIndex,
          text,
        });
      });
    });

    const translatedSegments = new Map<string, string>();
    const batches = createBatches(segments);

    for (const batch of batches) {
      const translations = await translateBatch(
        batch.map((segment) => segment.text)
      );

      batch.forEach((segment, index) => {
        translatedSegments.set(
          `${segment.targetIndex}:${segment.segmentIndex}`,
          translations[index] || segment.text
        );
      });
    }

    const result = new Map<number, string>();

    targets.forEach((target, targetIndex) => {
      const sourceParts = splitLongText(target.text);

      const translatedParts = sourceParts.map((sourcePart, segmentIndex) => {
        return (
          translatedSegments.get(`${targetIndex}:${segmentIndex}`) || sourcePart
        );
      });

      result.set(targetIndex, translatedParts.join("\n\n").trim() || target.text);
    });

    return result;
  }

  async function buildTranslationPayload(
    complaint: string,
    notes: string,
    laborItems: LaborItem[],
    partItems: PartItem[]
  ): Promise<TranslationPayload | null> {
    if (lang !== "fr") return null;

    const targets: TranslationTarget[] = [];

    const cleanComplaint = normalizeText(complaint);
    const cleanNotes = normalizeText(notes);

    if (cleanComplaint) {
      targets.push({
        type: "complaint",
        text: cleanComplaint,
      });
    }

    if (cleanNotes) {
      targets.push({
        type: "notes",
        text: cleanNotes,
      });
    }

    for (const item of laborItems) {
      const text = normalizeText(item.description);

      if (text) {
        targets.push({
          type: "labor",
          id: item.id,
          text,
        });
      }
    }

    for (const item of partItems) {
      const text = normalizeText(item.name);

      if (text) {
        targets.push({
          type: "part",
          id: item.id,
          text,
        });
      }
    }

    const translationsByTargetIndex = await translateTargets(targets);

    const translatedLaborById = new Map<string, string>();
    const translatedPartById = new Map<string, string>();

    let translatedComplaint = complaint || "";
    let translatedNotes = notes || "";

    targets.forEach((target, index) => {
      const translatedText =
        translationsByTargetIndex.get(index) || target.text;

      if (target.type === "complaint") {
        translatedComplaint = translatedText;
      } else if (target.type === "notes") {
        translatedNotes = translatedText;
      } else if (target.type === "labor") {
        translatedLaborById.set(target.id, translatedText);
      } else if (target.type === "part") {
        translatedPartById.set(target.id, translatedText);
      }
    });

    return {
      customer_complaint: translatedComplaint,
      notes: translatedNotes,
      labor_items: laborItems.map((item) => ({
        id: item.id,
        description:
          translatedLaborById.get(item.id) ||
          normalizeText(item.description) ||
          "",
      })),
      part_items: partItems.map((item) => ({
        id: item.id,
        name:
          translatedPartById.get(item.id) ||
          normalizeText(item.name) ||
          "",
        reference: normalizeText(item.reference) || null,
      })),
    };
  }

  async function createDocument(type: DocumentType) {
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      if (type === "order") {
        window.open(
          `/work-orders/${orderId}/documents/order/${lang}?seller=${seller}`,
          "_blank"
        );
        return;
      }

      const table = type === "devis" ? "devis" : "factures";

      const [
        { data: order, error: orderError },
        { data: laborItems, error: laborError },
        { data: partItems, error: partError },
      ] = await Promise.all([
        supabase
          .from("work_orders")
          .select("total_amount, customer_complaint, notes")
          .eq("id", orderId)
          .single(),

        supabase
          .from("work_order_labor_items")
          .select("id, description")
          .eq("work_order_id", orderId)
          .order("created_at", { ascending: true }),

        supabase
          .from("work_order_part_items")
          .select("id, name, reference")
          .eq("work_order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);

      if (orderError) throw orderError;
      if (laborError) throw laborError;
      if (partError) throw partError;

      const translationPayload = await buildTranslationPayload(
        order?.customer_complaint || "",
        order?.notes || "",
        (laborItems || []) as LaborItem[],
        (partItems || []) as PartItem[]
      );

      const ht = Number(order?.total_amount || 0);
      const tvaRate = seller === "srvauto" ? 0.2 : 0;
      const tva = ht * tvaRate;
      const ttc = ht + tva;

      const payload = {
        work_order_id: orderId,
        seller,
        lang,
        total_ht: ht,
        tva_amount: tva,
        total_ttc: ttc,
        source_lang: "ru",
        translated_payload: translationPayload,
        translated_at:
          translationPayload !== null ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      await addHistory({
        workOrderId: orderId,
        action: type === "devis" ? "Создан Devis" : "Создана Facture",
        description:
          lang === "fr"
            ? `${
                type === "devis" ? "Devis" : "Facture"
              } FR · AI-перевод сохранён`
            : `${type === "devis" ? "Devis" : "Facture"} RU`,
        color: "blue",
      });

      setMessage(
        lang === "fr"
          ? "Документ создан, французский перевод сохранён."
          : "Документ создан."
      );

      window.open(
        `/work-orders/${orderId}/documents/${type}/${lang}?seller=${seller}&documentId=${data.id}`,
        "_blank"
      );
    } catch (error: any) {
      alert(error?.message || "Не удалось создать документ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">Документы</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <select
          className="rounded-lg bg-zinc-950 p-3"
          value={seller}
          onChange={(event) => setSeller(event.target.value)}
          disabled={saving}
        >
          <option value="srvauto">SRV AUTO SARL — TVA 20%</option>
          <option value="serhii">SRV SERHII — TVA non applicable</option>
        </select>

        <select
          className="rounded-lg bg-zinc-950 p-3"
          value={lang}
          onChange={(event) => setLang(event.target.value)}
          disabled={saving}
        >
          <option value="fr">Français — traduction IA</option>
          <option value="ru">Русский</option>
        </select>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => createDocument("order")}
          className="rounded bg-zinc-700 px-4 py-3 font-bold hover:bg-zinc-600 disabled:opacity-50"
        >
          Заказ-наряд
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => createDocument("devis")}
          className="rounded bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Создаём..." : "Créer Devis"}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => createDocument("facture")}
          className="rounded bg-green-600 px-4 py-3 font-bold hover:bg-green-500 disabled:opacity-50"
        >
          {saving ? "Создаём..." : "Créer Facture"}
        </button>
      </div>

      {message && <p className="mt-4 text-sm text-green-400">{message}</p>}
    </div>
  );
}