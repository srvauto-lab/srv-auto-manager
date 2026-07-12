export const WORK_ORDER_STATUSES = [
  "Записан",
  "Принят",
  "Диагностика",
  "Ожидание запчастей",
  "В работе",
  "Готов",
  "Выдан",
  "Закрыт",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const DEFAULT_WORK_ORDER_STATUS: WorkOrderStatus = "Записан";

export const WORK_ORDER_STATUS_COLORS: Record<string, string> = {
  Записан: "bg-blue-600 text-white",
  Принят: "bg-green-500 text-black",
  Диагностика: "bg-yellow-500 text-black",
  "Ожидание запчастей": "bg-orange-500 text-black",
  "В работе": "bg-purple-600 text-white",
  Готов: "bg-emerald-500 text-black",
  Выдан: "bg-zinc-500 text-white",
  Закрыт: "bg-black text-white border border-zinc-700",
};

export function normalizeWorkOrderStatus(status: string | null | undefined) {
  if (!status) return DEFAULT_WORK_ORDER_STATUS;

  const value = status.trim().toLowerCase();

  const map: Record<string, WorkOrderStatus> = {
    nouveau: "Записан",
    new: "Записан",
    planned: "Записан",
    confirmed: "Принят",
    arrived: "Принят",
    accepted: "Принят",
    diagnostic: "Диагностика",
    diagnostics: "Диагностика",
    parts_waiting: "Ожидание запчастей",
    waiting_parts: "Ожидание запчастей",
    in_progress: "В работе",
    done: "Готов",
    ready: "Готов",
    delivered: "Выдан",
    paid: "Закрыт",
    closed: "Закрыт",
    cancelled: "Закрыт",
  };

  return map[value] || status;
}