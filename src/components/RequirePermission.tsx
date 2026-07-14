"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export default function RequirePermission({
  permission,
  children,
  fallbackHref = "/",
}: {
  permission: string;
  children: React.ReactNode;
  fallbackHref?: string;
}) {
  const router = useRouter();
  const { can, loading } = usePermissions();

  useEffect(() => {
    if (!loading && !can(permission)) {
      router.replace(
        `/forbidden?permission=${encodeURIComponent(permission)}&from=${encodeURIComponent(
          window.location.pathname
        )}`
      );
    }
  }, [can, loading, permission, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-green-500" />
          <p className="mt-4 text-sm text-zinc-400">
            Проверка прав доступа...
          </p>
        </div>
      </div>
    );
  }

  if (!can(permission)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="max-w-md rounded-2xl border border-red-900 bg-red-950/20 p-6 text-center">
          <ShieldAlert className="mx-auto text-red-400" size={42} />
          <h2 className="mt-4 text-xl font-bold text-red-300">
            Доступ запрещён
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            У вашей учётной записи нет разрешения на этот раздел.
          </p>
          <button
            type="button"
            onClick={() => router.replace(fallbackHref)}
            className="mt-5 rounded-lg bg-zinc-800 px-4 py-3 text-sm font-bold hover:bg-zinc-700"
          >
            Вернуться
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}