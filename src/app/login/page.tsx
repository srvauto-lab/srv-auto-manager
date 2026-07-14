"use client";

import { Suspense } from "react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("Введите email и пароль.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(
        error.message === "Invalid login credentials"
          ? "Неверный email или пароль."
          : error.message
      );
      return;
    }

    const redirectTo = searchParams.get("redirectTo");

    router.replace(
      redirectTo && redirectTo.startsWith("/") ? redirectTo : "/"
    );

    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-green-400">
            SRV AUTO
          </h1>

          <p className="mt-1 font-semibold text-zinc-300">
            Manager CRM
          </p>

          <p className="mt-3 text-sm text-zinc-500">
            Войдите в защищённую систему управления гаражом
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-400">
              Email
            </span>

            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              placeholder="garage@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-zinc-400">
              Пароль
            </span>

            <div className="flex overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 focus-within:border-green-500">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                placeholder="Введите пароль"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="px-4 text-sm font-semibold text-zinc-400 hover:text-white"
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </label>

          {errorMessage && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Доступ предоставляется только сотрудникам SRV AUTO.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Загрузка...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}
