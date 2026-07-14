"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageCircle, RefreshCw, Send, Smartphone } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePermissions } from "@/hooks/usePermissions";

type MessageLog = {
  id: string;
  created_at: string;
  channel: "sms" | "whatsapp";
  direction: "outbound" | "inbound";
  recipient: string;
  body: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};

type TemplateKey =
  | "appointment_confirmation"
  | "vehicle_ready"
  | "unpaid_invoice"
  | "service_reminder";

function normalizePhoneForLink(value: string, defaultCountryCode: string) {
  const raw = value.replace(/[^\d+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw.slice(1).replace(/\D/g, "");
  if (raw.startsWith("00")) return raw.slice(2).replace(/\D/g, "");
  if (raw.startsWith("0")) return `${defaultCountryCode.replace(/\D/g, "")}${raw.slice(1)}`;
  return `${defaultCountryCode.replace(/\D/g, "")}${raw}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

function senderName(log: MessageLog) {
  if (Array.isArray(log.profiles)) return log.profiles[0]?.full_name || "-";
  return log.profiles?.full_name || "-";
}

export default function ClientCommunications({
  clientId,
  clientName,
  phone,
  vehicleLabel = "",
  workOrderId,
  documentNumber = "",
  amount = "",
  appointmentDate = "",
  appointmentTime = "",
}: {
  clientId: string;
  clientName: string;
  phone: string | null;
  vehicleLabel?: string;
  workOrderId?: string | null;
  documentNumber?: string;
  amount?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}) {
  const { settings } = useAppSettings();
  const { can } = usePermissions();
  const [template, setTemplate] = useState<TemplateKey>("appointment_confirmation");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [feedback, setFeedback] = useState("");

  const linkPhone = useMemo(
    () => normalizePhoneForLink(phone || "", settings.communications.default_country_code),
    [phone, settings.communications.default_country_code]
  );

  function renderTemplate(key: TemplateKey) {
    return settings.communications[key]
      .replaceAll("{CLIENT}", clientName || "client")
      .replaceAll("{VEHICLE}", vehicleLabel || "votre véhicule")
      .replaceAll("{DATE}", appointmentDate || "la date convenue")
      .replaceAll("{TIME}", appointmentTime || "l’heure convenue")
      .replaceAll("{DOCUMENT}", documentNumber || "votre facture")
      .replaceAll("{AMOUNT}", amount || "le montant restant");
  }

  useEffect(() => {
    setMessage(renderTemplate(template));
    // Template dependencies are intentionally explicit so edited settings refresh the message.
  }, [template, settings.communications, clientName, vehicleLabel, appointmentDate, appointmentTime, documentNumber, amount]);

  async function loadLogs() {
    if (!can("communications.view")) return;
    setLoadingLogs(true);
    try {
      const response = await fetch(`/api/communications/send?clientId=${encodeURIComponent(clientId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить историю сообщений.");
      setLogs(data.messages || []);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Ошибка загрузки сообщений.");
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [clientId]);

  async function send(channel: "sms" | "whatsapp") {
    if (!phone) {
      setFeedback("У клиента не указан телефон.");
      return;
    }

    if (!message.trim()) {
      setFeedback("Введите текст сообщения.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          work_order_id: workOrderId || null,
          channel,
          message: message.trim(),
          default_country_code: settings.communications.default_country_code,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение.");
      setFeedback(channel === "sms" ? "SMS отправлено." : "WhatsApp отправлен.");
      await loadLogs();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Ошибка отправки.");
    } finally {
      setLoading(false);
    }
  }

  const whatsappUrl = linkPhone
    ? `https://wa.me/${linkPhone}?text=${encodeURIComponent(message)}`
    : "#";
  const smsUrl = linkPhone ? `sms:+${linkPhone}?body=${encodeURIComponent(message)}` : "#";

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-green-400">
            <MessageCircle size={18} /> WhatsApp и SMS
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Телефон: {phone || "не указан"}
          </p>
        </div>
        {can("communications.view") && (
          <button
            type="button"
            onClick={loadLogs}
            disabled={loadingLogs}
            className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white disabled:opacity-50"
            title="Обновить историю"
          >
            <RefreshCw size={17} className={loadingLogs ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <select
          value={template}
          onChange={(event) => setTemplate(event.target.value as TemplateKey)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"
        >
          <option value="appointment_confirmation">Подтверждение записи</option>
          <option value="vehicle_ready">Автомобиль готов</option>
          <option value="unpaid_invoice">Напоминание об оплате</option>
          <option value="service_reminder">Напоминание о сервисе</option>
        </select>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-28 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-green-500"
          placeholder="Текст сообщения"
          maxLength={1600}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!linkPhone}
          className={`inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold hover:bg-emerald-500 ${!linkPhone ? "pointer-events-none opacity-50" : ""}`}
        >
          <ExternalLink size={16} /> Открыть WhatsApp
        </a>
        <a
          href={smsUrl}
          aria-disabled={!linkPhone}
          className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold hover:bg-blue-500 ${!linkPhone ? "pointer-events-none opacity-50" : ""}`}
        >
          <Smartphone size={16} /> Открыть SMS
        </a>

        {can("communications.send") && (
          <>
            <button
              type="button"
              onClick={() => send("sms")}
              disabled={loading || !phone}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700 disabled:opacity-50"
            >
              <Send size={16} /> Отправить SMS через CRM
            </button>
            <button
              type="button"
              onClick={() => send("whatsapp")}
              disabled={loading || !phone}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold hover:bg-zinc-700 disabled:opacity-50"
            >
              <Send size={16} /> Отправить WhatsApp через CRM
            </button>
          </>
        )}
      </div>

      {feedback && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
          {feedback}
        </div>
      )}

      {can("communications.view") && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h3 className="text-sm font-bold text-zinc-300">История сообщений</h3>
          {logs.length ? (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {logs.map((log) => (
                <article key={log.id} className="rounded-lg bg-zinc-950 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-green-400">{log.channel}</span>
                    <span className="text-xs text-zinc-600">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{log.body}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {log.status} · {senderName(log)}
                    {log.error_message ? ` · ${log.error_message}` : ""}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">Сообщений пока нет.</p>
          )}
        </div>
      )}
    </section>
  );
}
