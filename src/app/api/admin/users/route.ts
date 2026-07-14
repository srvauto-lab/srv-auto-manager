import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "admin",
  "chief_mechanic",
  "reception",
  "mechanic",
  "accountant",
  "warehouse",
] as const;

type UserRole = (typeof ALLOWED_ROLES)[number];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && ALLOWED_ROLES.includes(value as UserRole);
}

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

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [
    {
      data: { users },
      error: usersError,
    },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, phone, is_active, created_at, updated_at")
      .order("created_at", { ascending: true }),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  return NextResponse.json(
    {
      users: users.map((user) => {
        const profile = profileMap.get(user.id);

        return {
          id: user.id,
          email: user.email || "",
          email_confirmed_at: user.email_confirmed_at || null,
          last_sign_in_at: user.last_sign_in_at || null,
          created_at: user.created_at,
          full_name:
            profile?.full_name ||
            cleanText(user.user_metadata?.full_name) ||
            "",
          role: profile?.role || "mechanic",
          phone: profile?.phone || "",
          is_active: profile?.is_active ?? true,
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
    role?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const email = cleanText(body.email).toLowerCase();
  const password = cleanText(body.password);
  const fullName = cleanText(body.full_name);
  const role = body.role;

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Укажи корректный email." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Пароль должен содержать минимум 8 символов." },
      { status: 400 }
    );
  }

  if (!fullName) {
    return NextResponse.json(
      { error: "Укажи имя сотрудника." },
      { status: 400 }
    );
  }

  if (!isUserRole(role)) {
    return NextResponse.json(
      { error: "Некорректная роль." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Не удалось создать пользователя." },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        full_name: fullName,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);

    return NextResponse.json(
      {
        error: "Пользователь не создан: не удалось сохранить профиль.",
        details: profileError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        full_name: fullName,
        role,
        is_active: true,
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: {
    id?: unknown;
    full_name?: unknown;
    role?: unknown;
    is_active?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const id = cleanText(body.id);
  const fullName = cleanText(body.full_name);
  const role = body.role;
  const isActive = body.is_active;

  if (!id || !fullName || !isUserRole(role) || typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "Некорректные данные пользователя." },
      { status: 400 }
    );
  }

  if (auth.user?.id === id && (role !== "admin" || !isActive)) {
    return NextResponse.json(
      {
        error:
          "Нельзя отключить собственный аккаунт или снять с себя роль администратора.",
      },
      { status: 400 }
    );
  }

  const { data: previousProfile, error: previousProfileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", id)
      .single();

  if (previousProfileError || !previousProfile) {
    return NextResponse.json(
      { error: previousProfileError?.message || "Профиль не найден." },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, full_name, role, is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Profiles are the single source of truth for employees. Keep future calendar
  // entries linked to the profile and refresh their display snapshot after rename.
  if (previousProfile.full_name !== fullName) {
    const today = new Date().toISOString().slice(0, 10);
    const { error: linkedAppointmentsError } = await supabaseAdmin
      .from("appointments")
      .update({ mechanic: fullName })
      .eq("mechanic_id", id)
      .gte("appointment_date", today);

    const { error: legacyAppointmentsError } = previousProfile.full_name
      ? await supabaseAdmin
          .from("appointments")
          .update({ mechanic: fullName, mechanic_id: id })
          .eq("mechanic", previousProfile.full_name)
          .is("mechanic_id", null)
          .gte("appointment_date", today)
      : { error: null };

    const appointmentsError = linkedAppointmentsError || legacyAppointmentsError;

    if (appointmentsError) {
      return NextResponse.json(
        {
          error: "Профиль сохранён, но будущие записи календаря не обновлены.",
          details: appointmentsError.message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: { id?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const id = cleanText(body.id);

  if (!id) {
    return NextResponse.json(
      { error: "Не указан пользователь." },
      { status: 400 }
    );
  }

  if (auth.user?.id === id) {
    return NextResponse.json(
      { error: "Нельзя удалить собственный аккаунт." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}