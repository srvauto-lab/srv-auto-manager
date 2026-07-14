"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

function ForbiddenPageContent() {
  const searchParams = useSearchParams();
  const permission = searchParams.get("permission");

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-red-950/20 p-8 text-center">
        <ShieldAlert className="mx-auto text-red-400" size={52} />

        <h1 className="mt-5 text-2xl font-black text-red-300">
          Доступ запрещён
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-400">
          У вашей учётной записи нет разрешения на открытие этого раздела.
        </p>

        {permission && (
          <p className="mt-3 rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
            Требуется право: {permission}
          </p>
        )}

        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[70vh] items-center justify-center bg-zinc-950 text-zinc-400">Загрузка...</main>}>
      <ForbiddenPageContent />
    </Suspense>
  );
}
