"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewClientPage() {
  const router = useRouter();

  const [clientType, setClientType] = useState("particulier");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [siren, setSiren] = useState("");
  const [siret, setSiret] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("clients").insert({
      client_type: clientType,
      full_name: fullName,
      company_name: companyName,
      siren,
      siret,
      vat_number: vatNumber,
      billing_address: billingAddress,
      delivery_address: deliveryAddress,
      phone,
      email,
      address,
      notes,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-green-400">Добавить клиента</h1>

      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-4">
        <select
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          value={clientType}
          onChange={(e) => setClientType(e.target.value)}
        >
          <option value="particulier">Particulier / Частное лицо</option>
          <option value="societe">Société / Фирма</option>
        </select>

        <input className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="ФИО контактного лица *" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

        {clientType === "societe" && (
          <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="Название фирмы *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="SIREN" value={siren} onChange={(e) => setSiren(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="SIRET" value={siret} onChange={(e) => setSiret(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="Numéro TVA intracommunautaire" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="Adresse de facturation" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
            <input className="w-full rounded-lg bg-zinc-950 p-3" placeholder="Adresse de livraison" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>
        )}

        <input className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} />
        <textarea className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3" placeholder="Комментарий" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black">
            {saving ? "Сохраняем..." : "Сохранить клиента"}
          </button>

          <button type="button" onClick={() => router.push("/clients")} className="rounded-lg border border-zinc-700 px-5 py-3">
            Отмена
          </button>
        </div>
      </form>
    </main>
  );
}