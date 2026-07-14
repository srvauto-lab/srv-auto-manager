import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const OPERATIONAL_ROLES = [
  "admin",
  "chief_mechanic",
  "reception",
  "mechanic",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 });
  }

  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_permission",
    { requested_permission: "calendar.view" }
  );

  if (permissionError || allowed !== true) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .in("role", [...OPERATIONAL_ROLES])
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mechanics: (data || [])
      .filter((profile) => Boolean(profile.full_name))
      .map((profile) => ({
        id: profile.id,
        name: profile.full_name,
        role: profile.role,
      })),
  });
}
