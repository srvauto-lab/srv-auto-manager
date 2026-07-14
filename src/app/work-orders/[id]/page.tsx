import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import WorkOrderEditor from "./WorkOrderEditor";
import DocumentActions from "@/components/DocumentActions";
import DocumentHistory from "@/components/DocumentHistory";
import WorkOrderChecklist from "@/components/WorkOrderChecklist";
import WorkOrderPhotos from "@/components/WorkOrderPhotos";
import WorkOrderShell from "@/components/WorkOrderShell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkOrderDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: order, error } = await supabase
    .from("work_orders")
    .select(
      "*, clients(full_name, phone, email), vehicles(brand, model, plate, vin)"
    )
    .eq("id", id)
    .single();

  const { data: laborItems } = await supabase
    .from("work_order_labor_items")
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  const { data: partItems } = await supabase
    .from("work_order_part_items")
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  const { data: devisList } = await supabase
    .from("devis")
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: false });

  const { data: factureList } = await supabase
    .from("factures")
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: false });

  if (error || !order) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        <h1 className="text-3xl font-bold text-red-400">
          Заказ-наряд не найден
        </h1>
      </main>
    );
  }

  const checklist = <WorkOrderChecklist workOrderId={id} />;
  const photos = <WorkOrderPhotos workOrderId={id} />;

  const documents = (
    <>
      <DocumentActions orderId={id} />
      <DocumentHistory
        workOrderId={id}
        devisList={devisList || []}
        factureList={factureList || []}
      />
    </>
  );

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <Link
        href="/work-orders"
        className="text-sm text-zinc-400 hover:text-green-400"
      >
        ← Назад к заказ-нарядам
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-green-400">
        Заказ-наряд {order.order_number || ""}
      </h1>

      <WorkOrderShell
  order={order}
  checklist={checklist}
  photos={photos}
  documents={documents}
>
        <WorkOrderEditor
          order={order}
          laborItems={laborItems || []}
          partItems={partItems || []}
        />
      </WorkOrderShell>
    </main>
  );
}
