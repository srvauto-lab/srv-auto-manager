"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";

const menu = [
  { href: "/", label: "🏠 Панель управления" },

  { href: "/clients", label: "👥 Клиенты" },
  { href: "/vehicles", label: "🚗 Автомобили" },

  { href: "/work-orders", label: "📄 Заказ-наряды" },
  { href: "/devis", label: "📋 Devis" },
  { href: "/factures", label: "🧾 Factures" },

  { href: "/service-catalog", label: "📚 Каталог работ" },
  { href: "/inventory", label: "📦 Склад" },

  { href: "/employees", label: "👨‍🔧 Сотрудники" },
  { href: "/suppliers", label: "🏢 Поставщики" },

  { href: "/calendar", label: "📅 Календарь" },
  { href: "/stats", label: "📊 Статистика" },

  { href: "/settings", label: "⚙️ Настройки" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocumentPage = pathname.includes("/documents/");

if (isDocumentPage) {
  return <>{children}</>;
}

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-zinc-800 bg-zinc-900 p-5">
          <h1 className="text-2xl font-bold text-green-400">SRV AUTO</h1>
          <p className="text-sm text-zinc-400">Manager CRM</p>

          <nav className="mt-8 space-y-2">
            {menu.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-4 py-3 text-sm font-medium ${
                    active
                      ? "bg-green-500 text-black"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-green-400"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
  <p className="font-bold text-green-400">SRV AUTO MANAGER</p>
  <p className="text-sm text-zinc-400">
    Управление гаражом, заказами, складом и клиентами
  </p>
</div>

<GlobalSearch />

<div className="text-sm text-zinc-400">
  Antibes · Garage CRM
</div>
            </div>
          </header>

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}