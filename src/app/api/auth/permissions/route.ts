import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Необходима авторизация." },
      { status: 401 }
    );
  }

  const [{ data: profile, error: profileError }, permissionsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", user.id)
        .single(),
      supabase.rpc("get_my_permissions"),
    ]);

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Профиль пользователя не найден." },
      { status: 403 }
    );
  }

  if (!profile.is_active) {
    return NextResponse.json(
      { error: "Аккаунт отключён." },
      { status: 403 }
    );
  }

  if (permissionsResult.error) {
    return NextResponse.json(
      { error: permissionsResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email || "",
        full_name: profile.full_name || "",
        role: profile.role,
        is_active: profile.is_active,
      },
      permissions: (permissionsResult.data || []).map(
        (item: { permission_key: string }) => item.permission_key
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
