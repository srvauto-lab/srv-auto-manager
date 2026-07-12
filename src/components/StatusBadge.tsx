import {
  normalizeWorkOrderStatus,
  WORK_ORDER_STATUS_COLORS,
} from "@/lib/workOrderStatus";

type Props = {
  status: string | null;
};

export default function StatusBadge({ status }: Props) {
  const normalized = normalizeWorkOrderStatus(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
        WORK_ORDER_STATUS_COLORS[normalized] ||
        "bg-zinc-700 text-zinc-200"
      }`}
    >
      {normalized}
    </span>
  );
}