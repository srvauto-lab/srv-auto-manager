import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    { requested_permission: "employees.view" }
  );

  if (permissionError || allowed !== true) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const [profilesResult, usersResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, phone, is_active, created_at, updated_at")
      .order("full_name"),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  const authUsers = new Map(
    usersResult.data.users.map((authUser) => [authUser.id, authUser])
  );

  return NextResponse.json({
    employees: (profilesResult.data || []).map((profile) => {
      const authUser = authUsers.get(profile.id);
      return {
        ...profile,
        email: authUser?.email || "",
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    }),
  });
}
