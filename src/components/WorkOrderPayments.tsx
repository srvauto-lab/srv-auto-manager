"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addHistory } from "@/lib/addHistory";
import { useAppSettings } from "@/hooks/useAppSettings";

type Props = {
  workOrder: any;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  note: string | null;
};

export default function WorkOrderPayments({ workOrder }: Props) {
  const { settings } = useAppSettings();
  const methods = settings.payment_methods;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (!method || !methods.includes(method)) {
      setMethod(methods[0] || "");
    }
  }, [method, methods]);
  async function loadPayments() {
    const { data, error } = await supabase
      .from("work_order_payments")
      .select("*")
      .eq("work_order_id", workOrder.id)
      .order("payment_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPayments(data || []);
  }

  useEffect(() => {
    loadPayments();
  }, [workOrder.id]);

  const paid = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );

  const total = Number(workOrder.total_amount || 0);
  const remaining = Math.max(0, total - paid);

  const paymentStatus =
    total > 0 && remaining <= 0
      ? "Оплачено"
      : paid > 0
      ? "Частично оплачено"
      : "Не оплачено";


  async function addPayment() {
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      alert("Введите корректную сумму.");
      return;
    }

    if (paymentAmount > remaining) {
      alert(`Сумма оплаты превышает остаток ${remaining.toFixed(2)} €.`);
      return;
    }

    if (!method) {
      alert("Выберите способ оплаты.");
      return;
    }

    setLoading(true);

    try {
      const paymentDate = new Date().toISOString();

      const { error: insertError } = await supabase
        .from("work_order_payments")
        .insert({
          work_order_id: workOrder.id,
          amount: paymentAmount,
          payment_method: method,
          payment_date: paymentDate,
          note: note.trim() || null,
        });

      if (insertError) throw insertError;

      await addHistory({
        workOrderId: workOrder.id,
        action: "Получена оплата",
        description: `${paymentAmount.toFixed(2)} € · ${method}${
          note.trim() ? ` · ${note.trim()}` : ""
        }`,
        color: "green",
      });

      setAmount("");
      setNote("");
      await loadPayments();
    } catch (error: any) {
      alert(error?.message || "Не удалось добавить платёж.");
    } finally {
      setLoading(false);
    }
  }

  async function deletePayment(payment: Payment) {
    if (!confirm(`Удалить платёж ${Number(payment.amount).toFixed(2)} €?`)) {
      return;
    }

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from("work_order_payments")
        .delete()
        .eq("id", payment.id);

      if (deleteError) throw deleteError;


      await addHistory({
        workOrderId: workOrder.id,
        action: "Удалён платёж",
        description: `${Number(payment.amount).toFixed(2)} € · ${
          payment.payment_method || "-"
        }`,
        color: "red",
      });

      await loadPayments();
    } catch (error: any) {
      alert(error?.message || "Не удалось удалить платёж.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">Оплата</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Общая сумма</p>
          <p className="mt-1 text-2xl font-bold">{total.toFixed(2)} €</p>
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Оплачено</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {paid.toFixed(2)} €
          </p>
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Осталось</p>
          <p className="mt-1 text-2xl font-bold text-orange-400">
            {remaining.toFixed(2)} €
          </p>
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Статус</p>
          <p
            className={`mt-1 text-xl font-bold ${
              paymentStatus === "Оплачено"
                ? "text-green-400"
                : paymentStatus === "Частично оплачено"
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {paymentStatus}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <input
          type="number"
          min="0"
          step="0.01"
          className="rounded bg-zinc-950 p-3"
          placeholder="Сумма €"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <select
          className="rounded bg-zinc-950 p-3"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        >
          {methods.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          className="rounded bg-zinc-950 p-3"
          placeholder="Комментарий"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <button
          type="button"
          disabled={loading}
          onClick={addPayment}
          className="rounded bg-green-500 px-4 py-3 font-bold text-black disabled:opacity-50"
        >
          {loading ? "Сохраняем..." : "Добавить оплату"}
        </button>
      </div>

      <div className="mt-8">
        <h3 className="mb-4 text-lg font-bold">История платежей</h3>

        {payments.length === 0 ? (
          <p className="text-zinc-500">Платежей пока нет.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-zinc-950 p-4"
              >
                <div>
                  <p className="font-bold text-green-400">
                    {Number(payment.amount || 0).toFixed(2)} €
                  </p>

                  <p className="text-sm text-zinc-400">
                    {payment.payment_method || "-"}
                  </p>

                  {payment.note && (
                    <p className="mt-1 text-xs text-zinc-500">{payment.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {new Date(payment.payment_date).toLocaleString("fr-FR")}
                  </span>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => deletePayment(payment)}
                    className="rounded bg-red-600 px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}