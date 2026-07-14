import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PermissionOverrideInput = {
  permission_key?: unknown;
  allowed?: unknown;
};

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Необходима авторизация." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    profile.role !== "admin"
  ) {
    return {
      error: NextResponse.json(
        { error: "Доступ разрешён только администратору." },
        { status: 403 }
      ),
      user: null,
    };
  }

  return { error: null, user };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const userId = cleanText(
    request.nextUrl.searchParams.get("userId")
  );

  const [permissionsResult, rolePermissionsResult] = await Promise.all([
    supabaseAdmin
      .from("app_permissions")
      .select(
        "permission_key, label, section, description, sort_order"
      )
      .order("sort_order", { ascending: true }),

    supabaseAdmin
      .from("role_permissions")
      .select("role, permission_key, allowed"),
  ]);

  if (permissionsResult.error) {
    return NextResponse.json(
      { error: permissionsResult.error.message },
      { status: 500 }
    );
  }

  if (rolePermissionsResult.error) {
    return NextResponse.json(
      { error: rolePermissionsResult.error.message },
      { status: 500 }
    );
  }

  let overrides: Array<{
    user_id: string;
    permission_key: string;
    allowed: boolean;
  }> = [];

  if (userId) {
    const { data, error } = await supabaseAdmin
      .from("user_permission_overrides")
      .select("user_id, permission_key, allowed")
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    overrides = data || [];
  }

  return NextResponse.json(
    {
      permissions: permissionsResult.data || [],
      role_permissions: rolePermissionsResult.data || [],
      overrides,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: {
    user_id?: unknown;
    overrides?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный JSON." },
      { status: 400 }
    );
  }

  const userId = cleanText(body.user_id);

  if (!userId) {
    return NextResponse.json(
      { error: "Не указан пользователь." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.overrides)) {
    return NextResponse.json(
      { error: "Поле overrides должно быть массивом." },
      { status: 400 }
    );
  }

  let normalizedOverrides: Array<{
    user_id: string;
    permission_key: string;
    allowed: boolean;
    updated_at: string;
  }>;

  try {
    normalizedOverrides = body.overrides.map(
      (item: PermissionOverrideInput) => {
        const permissionKey = cleanText(item.permission_key);

        if (!permissionKey) {
          throw new Error("У одного из разрешений нет ключа.");
        }

        if (typeof item.allowed !== "boolean") {
          throw new Error(
            `Некорректное значение разрешения ${permissionKey}.`
          );
        }

        return {
          user_id: userId,
          permission_key: permissionKey,
          allowed: item.allowed,
          updated_at: new Date().toISOString(),
        };
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Некорректные разрешения.",
      },
      { status: 400 }
    );
  }

  const { data: userProfile, error: userProfileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

  if (userProfileError || !userProfile) {
    return NextResponse.json(
      { error: "Профиль пользователя не найден." },
      { status: 404 }
    );
  }

  if (userProfile.role === "admin") {
    return NextResponse.json(
      {
        error:
          "Для администратора индивидуальные ограничения не применяются.",
      },
      { status: 400 }
    );
  }

  const permissionKeys = normalizedOverrides.map(
    (item) => item.permission_key
  );

  if (permissionKeys.length) {
    const { data: existingPermissions, error: permissionsError } =
      await supabaseAdmin
        .from("app_permissions")
        .select("permission_key")
        .in("permission_key", permissionKeys);

    if (permissionsError) {
      return NextResponse.json(
        { error: permissionsError.message },
        { status: 500 }
      );
    }

    const existingKeys = new Set(
      (existingPermissions || []).map(
        (item) => item.permission_key
      )
    );

    const unknownKeys = permissionKeys.filter(
      (key) => !existingKeys.has(key)
    );

    if (unknownKeys.length) {
      return NextResponse.json(
        {
          error: `Неизвестные разрешения: ${unknownKeys.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("user_permission_overrides")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  if (normalizedOverrides.length) {
    const { error: insertError } = await supabaseAdmin
      .from("user_permission_overrides")
      .insert(normalizedOverrides);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    overrides: normalizedOverrides,
  });
}