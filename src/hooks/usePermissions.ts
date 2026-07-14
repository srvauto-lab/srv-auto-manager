"use client";

import { useEffect, useState } from "react";

type AuthData = {
  user: {
    id: string;
    full_name: string;
    role: string;
  };
  permissions: string[];
};

export function usePermissions() {
  const [data, setData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/auth/permissions", { cache: "no-store" });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Не удалось загрузить права.");
        }

        if (active) setData(json);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Ошибка прав доступа.");
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  function can(permission: string) {
    return data?.permissions.includes(permission) ?? false;
  }

  return {
    loading,
    user: data?.user,
    permissions: data?.permissions ?? [],
    can,
    error,
  };
}