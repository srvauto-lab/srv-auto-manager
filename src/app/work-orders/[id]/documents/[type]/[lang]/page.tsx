import { createClient } from "@/lib/supabase/server";
import DocumentTemplate from "@/components/DocumentTemplate";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; type: string; lang: string }>;
  searchParams: Promise<{ seller?: string; documentId?: string }>;
};

type CompanySettingsRow = {
  key: string;
  name: string | null;
  legal_form: string | null;
  capital: string | null;
  address: string | null;
  siren: string | null;
  siret: string | null;
  rcs: string | null;
  ape: string | null;
  tva_number: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  manager_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  tva_rate: number | null;
  vat_mention: string | null;
  invoice_footer: string | null;
  devis_footer: string | null;
  work_order_footer: string | null;
  payment_terms: string | null;
  warranty_terms: string | null;
  late_penalty_terms: string | null;
  recovery_terms: string | null;
  custom_legal_text: string | null;
  default_devis_validity_days: number | null;
  default_invoice_due_days: number | null;
};

const fallbackSellers = {
  srvauto: {
    key: "srvauto",
    name: "SRV AUTO SARL",
    legal_form: "SARL",
    capital: "3 000 €",
    address: "ZI des 3 Moulins, 282 rue des Cistes, 06600 Antibes, France",
    siren: "994 009 660",
    siret: "994 009 660 00014",
    rcs: "RCS Antibes 994 009 660",
    ape: "45.20A",
    tva_number: process.env.SRV_AUTO_TVA_NUMBER || "",
    phone: process.env.SRV_AUTO_PHONE || "",
    email: process.env.SRV_AUTO_EMAIL || "",
    website: "",
    iban: "",
    bic: "",
    bank_name: "",
    logo_url: "",
    signature_url: "",
    stamp_url: "",
    manager_name: "",
    whatsapp: "",
    instagram: "",
    tva_rate: 0.2,
    vat_mention: "",
    invoice_footer: "",
    devis_footer: "",
    work_order_footer: "",
    payment_terms: "",
    warranty_terms: "",
    late_penalty_terms: "",
    recovery_terms: "",
    custom_legal_text: "",
    default_devis_validity_days: 30,
    default_invoice_due_days: 0,
  },
  serhii: {
    key: "serhii",
    name: "SRV SERHII — YEVANHELIEV Serhii EI",
    legal_form: "Entrepreneur individuel",
    capital: "",
    address: "113 Boulevard Sadi Carnot, 06110 Le Cannet, France",
    siren: "106 000 342",
    siret: "106 000 342 00019",
    rcs: "",
    ape: "45.20A",
    tva_number: "",
    phone: process.env.SRV_SERHII_PHONE || "",
    email: process.env.SRV_SERHII_EMAIL || "",
    website: "",
    iban: "",
    bic: "",
    bank_name: "",
    logo_url: "",
    signature_url: "",
    stamp_url: "",
    manager_name: "",
    whatsapp: "",
    instagram: "",
    tva_rate: 0,
    vat_mention: "TVA non applicable, art. 293 B du CGI.",
    invoice_footer: "",
    devis_footer: "",
    work_order_footer: "",
    payment_terms: "",
    warranty_terms: "",
    late_penalty_terms: "",
    recovery_terms: "",
    custom_legal_text: "",
    default_devis_validity_days: 30,
    default_invoice_due_days: 0,
  },
};

const dict = {
  fr: {
    order: "Ordre de réparation",
    devis: "Devis",
    facture: "Facture",
    client: "Client",
    vehicle: "Véhicule",
    mileage: "Kilométrage",
    complaint: "Demande client",
    qty: "Qté",
    totalHt: "Total HT",
    tva: "TVA",
    totalTtc: "Total TTC",
    date: "Date",
  },
  ru: {
    order: "Заказ-наряд",
    devis: "Смета",
    facture: "Фактура",
    client: "Клиент",
    vehicle: "Автомобиль",
    mileage: "Пробег",
    complaint: "Жалоба клиента",
    qty: "Кол-во",
    totalHt: "Итого HT",
    tva: "НДС",
    totalTtc: "Итого TTC",
    date: "Дата",
  },
};

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSellerData(row: CompanySettingsRow) {
  return {
    name: row.name || "",
    legalForm: row.legal_form || "",
    capital: row.capital || "",
    address: row.address || "",
    siren: row.siren || "",
    siret: row.siret || "",
    rcs: row.rcs || "",
    ape: row.ape || "",
    tva: row.tva_number || "",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    iban: row.iban || "",
    bic: row.bic || "",
    bankName: row.bank_name || "",
    logoUrl: row.logo_url || "",
    signatureUrl: row.signature_url || "",
    stampUrl: row.stamp_url || "",
    managerName: row.manager_name || "",
    whatsapp: row.whatsapp || "",
    instagram: row.instagram || "",
    tvaRate: numberOrFallback(row.tva_rate, 0),
    vatMention: row.vat_mention || "",
    invoiceFooter: row.invoice_footer || "",
    devisFooter: row.devis_footer || "",
    workOrderFooter: row.work_order_footer || "",
    paymentTerms: row.payment_terms || "",
    warrantyTerms: row.warranty_terms || "",
    latePenaltyTerms: row.late_penalty_terms || "",
    recoveryTerms: row.recovery_terms || "",
    customLegalText: row.custom_legal_text || "",
  };
}

export default async function DocumentPage({ params, searchParams }: PageProps) {
  const supabase = await createClient();
  const { id, type, lang } = await params;
  const { seller, documentId } = await searchParams;

  const documentLang = lang === "ru" ? "ru" : "fr";
  const labels = dict[documentLang];
  const sellerKey = seller === "serhii" ? "serhii" : "srvauto";

  const [
    orderResult,
    laborResult,
    partsResult,
    signatureResult,
    photosResult,
    paymentsResult,
    companyResult,
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "*, clients(full_name, phone, email, address, siren), vehicles(id, brand, model, plate, vin)"
      )
      .eq("id", id)
      .single(),

    supabase
      .from("work_order_labor_items")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("work_order_part_items")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("work_order_signatures")
      .select("*")
      .eq("work_order_id", id)
      .eq("signature_type", type === "facture" ? "delivery" : "reception")
      .maybeSingle(),

    supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("work_order_payments")
      .select("*")
      .eq("work_order_id", id)
      .order("payment_date", { ascending: true }),

    supabase
      .from("company_settings")
      .select("*")
      .eq("key", sellerKey)
      .maybeSingle(),
  ]);

  const order = orderResult.data;

  if (!order) {
    return <main className="p-8">Document not found</main>;
  }

  const companyRow =
    (companyResult.data as CompanySettingsRow | null) ||
    (fallbackSellers[sellerKey] as CompanySettingsRow);

  const sellerData = toSellerData(companyRow);

  let documentNumber = order.order_number || "-";
  let documentRecord: any = null;

  if (documentId && type === "devis") {
    const { data } = await supabase
      .from("devis")
      .select("*")
      .eq("id", documentId)
      .single();

    documentRecord = data;
    documentNumber = data?.devis_number || documentNumber;
  }

  if (documentId && type === "facture") {
    const { data } = await supabase
      .from("factures")
      .select("*")
      .eq("id", documentId)
      .single();

    documentRecord = data;
    documentNumber = data?.facture_number || documentNumber;
  }

  let laborItems = laborResult.data || [];
  let partItems = partsResult.data || [];
  const documentOrder = { ...order };

  const translated = documentRecord?.translated_payload;

  if (documentLang === "fr" && translated) {
    documentOrder.customer_complaint =
      translated.customer_complaint || order.customer_complaint;

    documentOrder.notes = translated.notes || order.notes;

    const translatedLabors = new Map<
      string,
      { id: string; description?: string }
    >(
      (translated.labor_items || []).map((item: any) => [
        String(item.id),
        item,
      ])
    );

    laborItems = laborItems.map((item: any) => ({
      ...item,
      description:
        translatedLabors.get(String(item.id))?.description || item.description,
    }));

    const translatedParts = new Map<string, { id: string; name?: string }>(
      (translated.part_items || []).map((item: any) => [
        String(item.id),
        item,
      ])
    );

    partItems = partItems.map((item: any) => ({
      ...item,
      name: translatedParts.get(String(item.id))?.name || item.name,
    }));
  }

  const title =
    type === "facture"
      ? labels.facture
      : type === "devis"
      ? labels.devis
      : labels.order;

  const currentHt = Number(order.total_amount || 0);
  const ht = Number(documentRecord?.total_ht ?? currentHt);

  const tva = Number(
    documentRecord?.tva_amount ??
      (type === "order" ? 0 : ht * sellerData.tvaRate)
  );

  const ttc = Number(documentRecord?.total_ttc ?? ht + tva);

  const payments = paymentsResult.data || [];

  const paid = payments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const issueDate = documentRecord?.created_at
    ? new Date(documentRecord.created_at)
    : new Date();

  const devisValidityDays = numberOrFallback(
    companyRow.default_devis_validity_days,
    30
  );

  const invoiceDueDays = numberOrFallback(
    companyRow.default_invoice_due_days,
    0
  );

  const { data: recommendationsData } = order.vehicles?.id
    ? await supabase
        .from("vehicle_recommendations")
        .select("*")
        .eq("vehicle_id", order.vehicles.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const recommendations = recommendationsData || [];

  return (
    <DocumentTemplate
      title={title}
      documentNumber={documentNumber}
      date={issueDate.toLocaleDateString("fr-FR")}
      dueDate={addDays(issueDate, invoiceDueDays).toLocaleDateString("fr-FR")}
      validUntil={addDays(issueDate, devisValidityDays).toLocaleDateString(
        "fr-FR"
      )}
      seller={sellerData}
      order={documentOrder}
      laborItems={laborItems}
      partItems={partItems}
      labels={labels}
      totals={{
        ht,
        tva,
        ttc,
        paid,
        remaining: Math.max(0, ttc - paid),
      }}
      type={type}
      signature={signatureResult.data || null}
      photos={photosResult.data || []}
      recommendations={recommendations}
      payments={payments}
    />
  );
}
