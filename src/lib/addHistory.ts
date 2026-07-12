import { supabase } from "@/lib/supabase";

type AddHistoryParams = {
  workOrderId: string;
  action: string;
  description?: string;
  color?: "green" | "yellow" | "blue" | "red" | "gray";
  userName?: string;
};

export async function addHistory({
  workOrderId,
  action,
  description = "",
  color = "gray",
  userName = "",
}: AddHistoryParams) {
  const { error } = await supabase
    .from("work_order_history")
    .insert({
      work_order_id: workOrderId,
      action,
      description,
      color,
      user_name: userName || null,
    });

  if (error) {
    console.error("History:", error.message);
  }
}