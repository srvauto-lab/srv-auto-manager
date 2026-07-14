"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AppSettings,
  defaultAppSettings,
  normalizeAppSettings,
} from "@/lib/appSettings";

const EVENT_NAME = "srv-app-settings-updated";

export function notifyAppSettingsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", "main")
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setSettings(defaultAppSettings);
    } else {
      setSettings(normalizeAppSettings(data?.settings));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();

    function handleUpdate() {
      void reload();
    }

    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(EVENT_NAME, handleUpdate);
  }, [reload]);

  return { settings, loading, error, reload };
}
