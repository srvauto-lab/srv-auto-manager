"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppSettings } from "@/hooks/useAppSettings";

type UserRole =
  | "admin"
  | "chief_mechanic"
  | "reception"
  | "mechanic"
  | "accountant"
  | "warehouse";

type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
};

type MenuItem = {
  href: string;
  label: string;
  compactLabel: string;
  icon: LucideIcon;
  permission: string;
};

const menu: MenuItem[] = [
  {
    href: "/",
    label: "Панель управления",
    compactLabel: "Панель",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    href: "/clients",
    label: "Клиенты",
    compactLabel: "Клиенты",
    icon: Users,
    permission: "clients.view",
  },
  {
    href: "/vehicles",
    label: "Автомобили",
    compactLabel: "Авто",
    icon: Car,
    permission: "vehicles.view",
  },
  {
    href: "/work-orders",
    label: "Заказ-наряды",
    compactLabel: "Заказы",
    icon: ClipboardList,
    permission: "work_orders.view",
  },
  {
    href: "/devis",
    label: "Devis",
    compactLabel: "Devis",
    icon: FileText,
    permission: "devis.view",
  },
  {
    href: "/factures",
    label: "Factures",
    compactLabel: "Factures",
    icon: ReceiptText,
    permission: "factures.view",
  },
  {
    href: "/service-catalog",
    label: "Каталог работ",
    compactLabel: "Каталог",
    icon: BookOpen,
    permission: "service_catalog.view",
  },
  {
    href: "/inventory",
    label: "Склад",
    compactLabel: "Склад",
    icon: Boxes,
    permission: "inventory.view",
  },
  {
    href: "/employees",
    label: "Сотрудники",
    compactLabel: "Команда",
    icon: Wrench,
    permission: "employees.view",
  },
  {
    href: "/suppliers",
    label: "Поставщики",
    compactLabel: "Поставщики",
    icon: Building2,
    permission: "suppliers.view",
  },
  {
    href: "/calendar",
    label: "Календарь",
    compactLabel: "Календарь",
    icon: CalendarDays,
    permission: "calendar.view",
  },
  {
    href: "/profit",
    label: "Прибыль",
    compactLabel: "Прибыль",
    icon: TrendingUp,
    permission: "profit.view",
  },
  {
    href: "/audit",
    label: "Журнал действий",
    compactLabel: "Журнал",
    icon: History,
    permission: "audit.view",
  },
  {
    href: "/access",
    label: "Права доступа",
    compactLabel: "Доступ",
    icon: ShieldCheck,
    permission: "access.manage",
  },
  {
    href: "/settings",
    label: "Настройки",
    compactLabel: "Настройки",
    icon: Settings,
    permission: "settings.manage",
  },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Администратор",
  chief_mechanic: "Главный механик",
  reception: "Приёмщик",
  mechanic: "Механик",
  accountant: "Бухгалтер",
  warehouse: "Склад",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { can, loading: permissionsLoading, error: permissionsError } = usePermissions();
  const { settings } = useAppSettings();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isLoginPage = pathname === "/login";
  const isDocumentPage = pathname.includes("/documents/");

  useEffect(() => {
    const stored = window.localStorage.getItem("srv-sidebar-compact");
    setCompact(stored === null ? settings.appearance.compact_mode : stored === "true");
  }, [settings.appearance.compact_mode]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (permissionsLoading || isLoginPage || isDocumentPage) return;

    const matchingItem = [...menu]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) =>
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
      );

    if (matchingItem && !can(matchingItem.permission)) {
      router.replace(`/forbidden?permission=${encodeURIComponent(matchingItem.permission)}`);
    }
  }, [can, isDocumentPage, isLoginPage, pathname, permissionsLoading, router]);

  useEffect(() => {
    if (isLoginPage || isDocumentPage) {
      setLoadingUser(false);
      return;
    }

    let active = true;

    async function loadUser() {
      setLoadingUser(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`);
        return;
      }

      setEmail(user.email || "");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!profileData.is_active) {
        await supabase.auth.signOut();
        alert("Ваш аккаунт отключён администратором.");
        router.replace("/login");
        return;
      }

      setProfile(profileData as Profile);
      setLoadingUser(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
        router.refresh();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isDocumentPage, isLoginPage, pathname, router, supabase]);

  function toggleCompact() {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem("srv-sidebar-compact", String(next));
      return next;
    });
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (isLoginPage || isDocumentPage) {
    return <>{children}</>;
  }

  if (permissionsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="max-w-lg rounded-xl border border-red-900 bg-red-950/30 p-5 text-red-300">
          Не удалось загрузить права доступа: {permissionsError}
        </div>
      </div>
    );
  }

  if (loadingUser || permissionsLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-green-500" />
          <p className="mt-4 text-sm text-zinc-400">Загрузка CRM...</p>
        </div>
      </div>
    );
  }

  const visibleMenu = menu.filter((item) => can(item.permission));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-800 bg-zinc-900 shadow-2xl transition-[width,transform] duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${compact ? "w-72 lg:w-40" : "w-72 lg:w-56"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight text-green-400">
              SRV AUTO
            </h1>
            {!compact && <p className="text-xs text-zinc-500">Manager CRM</p>}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden"
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-1">
            {visibleMenu.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={compact ? item.label : undefined}
                  className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-green-500" />
                  )}

                  <Icon
                    size={19}
                    strokeWidth={active ? 2.4 : 2}
                    className={`shrink-0 ${
                      active
                        ? "text-green-400"
                        : "text-zinc-500 group-hover:text-green-400"
                    }`}
                  />

                  <span className={`truncate ${compact ? "text-xs" : "text-sm"}`}>
                    {compact ? item.compactLabel : item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <div className="mb-3 rounded-lg bg-zinc-950 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-green-400">
                <UserRound size={18} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {profile.full_name || email || "Пользователь"}
                </p>
                <p className="mt-0.5 truncate text-xs text-green-400">
                  {roleLabels[profile.role]}
                </p>

                {!compact && email && (
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{email}</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-50"
          >
            <LogOut size={17} />
            <span>{loggingOut ? "Выходим..." : "Выйти"}</span>
          </button>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          compact ? "lg:pl-40" : "lg:pl-56"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2.5 text-zinc-300 hover:bg-zinc-800 lg:hidden"
              aria-label="Открыть меню"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              onClick={toggleCompact}
              className="hidden rounded-lg p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:block"
              title={compact ? "Расширить меню" : "Сделать меню компактным"}
              aria-label={
                compact ? "Расширить меню" : "Сделать меню компактным"
              }
            >
              {compact ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>

            <div className="hidden shrink-0 xl:block">
              <p className="font-bold tracking-tight text-green-400">
                {settings.appearance.company_title || "SRV AUTO MANAGER"}
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <GlobalSearch />
            </div>

            <div className="hidden max-w-52 min-w-0 text-right md:block">
              <p className="truncate text-sm font-bold">
                {profile.full_name || email}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {roleLabels[profile.role]}
              </p>
            </div>
          </div>
        </header>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}