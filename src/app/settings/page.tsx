"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  key: string;
  name: string;
  legal_form: string | null;
  address: string | null;
  siren: string | null;
  siret: string | null;
  rcs: string | null;
  ape: string | null;
  tva_number: string | null;
  capital: string | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  google_maps_url: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  tva_rate: number | null;
  vat_mention: string | null;
  invoice_footer: string | null;
  devis_footer: string | null;
  work_order_footer: string | null;
  payment_terms: string | null;
  warranty_terms: string | null;
  late_penalty_terms: string | null;
  recovery_terms: string | null;
  custom_legal_text: string | null;
  default_devis_validity_days: number | null;
  default_invoice_due_days: number | null;
  default_deposit_percent: number | null;
  currency: string | null;
  is_default: boolean | null;
};

type AppSettings = {
  default_seller: string;
  default_document_language: string;
  invoice_prefix: string;
  devis_prefix: string;
  work_order_prefix: string;
  invoice_number_format: string;
  devis_number_format: string;
  work_order_number_format: string;
  mechanics: string[];
  lifts: string[];
  payment_methods: string[];
  work_order_statuses: string[];
  opening_hours: Record<string, string>;
  reminders: {
    service_days: number;
    unpaid_invoice_days: number;
    vehicle_ready_days: number;
  };
  ai: {
    enabled: boolean;
    model: string;
    target_language: string;
    translation_style: string;
  };
  appearance: {
    accent: string;
    compact_mode: boolean;
    company_title: string;
  };
};

const defaultSettings: AppSettings = {
  default_seller: "srvauto",
  default_document_language: "fr",
  invoice_prefix: "FA",
  devis_prefix: "DV",
  work_order_prefix: "OR",
  invoice_number_format: "{PREFIX}-{YY}{MM}-{SEQ6}",
  devis_number_format: "{PREFIX}-{YY}{MM}-{SEQ6}",
  work_order_number_format: "{YY}-{DD}-{MM}-{SEQ3}",
  mechanics: ["Сергей", "Вадим", "Роберт"],
  lifts: ["Пост №1", "Пост №2", "Пост №3", "Пост приёмки / диагностики"],
  payment_methods: ["Наличные", "Карта", "Перевод", "Чек"],
  work_order_statuses: [
    "Записан",
    "Принят",
    "Диагностика",
    "Ожидание запчастей",
    "В работе",
    "Готов",
    "Выдан",
    "Закрыт",
  ],
  opening_hours: {
    monday: "08:00-18:00",
    tuesday: "08:00-18:00",
    wednesday: "08:00-18:00",
    thursday: "08:00-18:00",
    friday: "08:00-18:00",
    saturday: "09:00-13:00",
    sunday: "closed",
  },
  reminders: {
    service_days: 180,
    unpaid_invoice_days: 7,
    vehicle_ready_days: 3,
  },
  ai: {
    enabled: true,
    model: "gpt-5-mini",
    target_language: "fr",
    translation_style: "professional_garage",
  },
  appearance: {
    accent: "green",
    compact_mode: true,
    company_title: "SRV AUTO MANAGER",
  },
};

const tabs = [
  ["companies", "Компании"],
  ["documents", "Документы"],
  ["numbering", "Нумерация"],
  ["garage", "Гараж"],
  ["finance", "Финансы"],
  ["reminders", "Напоминания"],
  ["ai", "AI"],
  ["appearance", "Внешний вид"],
] as const;

type TabKey = (typeof tabs)[number][0];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadData() {
    setLoading(true);

    const [companiesResult, settingsResult] = await Promise.all([
      supabase.from("company_settings").select("*").order("key"),
      supabase.from("app_settings").select("settings").eq("id", "main").maybeSingle(),
    ]);

    if (companiesResult.error) {
      alert(companiesResult.error.message);
    } else {
      setCompanies((companiesResult.data || []) as Company[]);
    }

    if (settingsResult.error) {
      alert(settingsResult.error.message);
    } else {
      setSettings({
        ...defaultSettings,
        ...(settingsResult.data?.settings || {}),
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateCompany(
    index: number,
    field: keyof Company,
    value: string | number | boolean
  ) {
    setCompanies((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function updateSettings<K extends keyof AppSettings>(
    field: K,
    value: AppSettings[K]
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function csvToArray(value: string) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function arrayToText(value: string[]) {
    return value.join("\n");
  }

  async function saveCompany(company: Company) {
    setSavingCompanyId(company.id);

    const payload = { ...company };
    delete (payload as Partial<Company>).id;
    delete (payload as Partial<Company>).key;

    const { error } = await supabase
      .from("company_settings")
      .update(payload)
      .eq("id", company.id);

    setSavingCompanyId(null);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Реквизиты сохранены.");
    await loadData();
  }

  async function saveAllSettings() {
    setSavingSettings(true);

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        id: "main",
        settings,
        updated_at: new Date().toISOString(),
      });

    setSavingSettings(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Настройки сохранены.");
  }

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: company.key,
        label: company.name || company.key,
      })),
    [companies]
  );

  if (loading) {
    return <main className="p-8 text-zinc-400">Загрузка настроек...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Настройки</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Реквизиты, документы, гараж, финансы и системные параметры
          </p>
        </div>

        <button
          type="button"
          onClick={saveAllSettings}
          disabled={savingSettings}
          className="rounded-lg bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
        >
          {savingSettings ? "Сохраняем..." : "Сохранить общие настройки"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2.5 text-sm font-bold ${
              tab === key
                ? "bg-green-500 text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "companies" && (
          <div className="space-y-6">
            {companies.map((company, index) => (
              <section
                key={company.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-green-400">
                      {company.name || company.key}
                    </h2>
                    <p className="text-xs text-zinc-500">{company.key}</p>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(company.is_default)}
                      onChange={(event) =>
                        updateCompany(index, "is_default", event.target.checked)
                      }
                    />
                    Компания по умолчанию
                  </label>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Название">
                    <input
                      value={company.name || ""}
                      onChange={(e) => updateCompany(index, "name", e.target.value)}
                    />
                  </Field>

                  <Field label="Юридическая форма">
                    <input
                      value={company.legal_form || ""}
                      onChange={(e) =>
                        updateCompany(index, "legal_form", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Управляющий / Responsable">
                    <input
                      value={company.manager_name || ""}
                      onChange={(e) =>
                        updateCompany(index, "manager_name", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="SIREN">
                    <input
                      value={company.siren || ""}
                      onChange={(e) => updateCompany(index, "siren", e.target.value)}
                    />
                  </Field>

                  <Field label="SIRET">
                    <input
                      value={company.siret || ""}
                      onChange={(e) => updateCompany(index, "siret", e.target.value)}
                    />
                  </Field>

                  <Field label="RCS">
                    <input
                      value={company.rcs || ""}
                      onChange={(e) => updateCompany(index, "rcs", e.target.value)}
                    />
                  </Field>

                  <Field label="APE">
                    <input
                      value={company.ape || ""}
                      onChange={(e) => updateCompany(index, "ape", e.target.value)}
                    />
                  </Field>

                  <Field label="Capital">
                    <input
                      value={company.capital || ""}
                      onChange={(e) =>
                        updateCompany(index, "capital", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Numéro TVA">
                    <input
                      value={company.tva_number || ""}
                      onChange={(e) =>
                        updateCompany(index, "tva_number", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="TVA rate">
                    <input
                      type="number"
                      step="0.01"
                      value={company.tva_rate ?? 0}
                      onChange={(e) =>
                        updateCompany(index, "tva_rate", Number(e.target.value || 0))
                      }
                    />
                  </Field>

                  <Field label="Телефон">
                    <input
                      value={company.phone || ""}
                      onChange={(e) => updateCompany(index, "phone", e.target.value)}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      value={company.email || ""}
                      onChange={(e) => updateCompany(index, "email", e.target.value)}
                    />
                  </Field>

                  <Field label="Сайт">
                    <input
                      value={company.website || ""}
                      onChange={(e) =>
                        updateCompany(index, "website", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <input
                      value={company.whatsapp || ""}
                      onChange={(e) =>
                        updateCompany(index, "whatsapp", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Instagram">
                    <input
                      value={company.instagram || ""}
                      onChange={(e) =>
                        updateCompany(index, "instagram", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Facebook">
                    <input
                      value={company.facebook || ""}
                      onChange={(e) =>
                        updateCompany(index, "facebook", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Google Maps URL">
                    <input
                      value={company.google_maps_url || ""}
                      onChange={(e) =>
                        updateCompany(index, "google_maps_url", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="IBAN">
                    <input
                      value={company.iban || ""}
                      onChange={(e) => updateCompany(index, "iban", e.target.value)}
                    />
                  </Field>

                  <Field label="BIC">
                    <input
                      value={company.bic || ""}
                      onChange={(e) => updateCompany(index, "bic", e.target.value)}
                    />
                  </Field>

                  <Field label="Банк">
                    <input
                      value={company.bank_name || ""}
                      onChange={(e) =>
                        updateCompany(index, "bank_name", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Логотип URL">
                    <input
                      value={company.logo_url || ""}
                      onChange={(e) =>
                        updateCompany(index, "logo_url", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Подпись URL">
                    <input
                      value={company.signature_url || ""}
                      onChange={(e) =>
                        updateCompany(index, "signature_url", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Печать URL">
                    <input
                      value={company.stamp_url || ""}
                      onChange={(e) =>
                        updateCompany(index, "stamp_url", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Валюта">
                    <input
                      value={company.currency || "EUR"}
                      onChange={(e) =>
                        updateCompany(index, "currency", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Срок Devis, дней">
                    <input
                      type="number"
                      value={company.default_devis_validity_days ?? 30}
                      onChange={(e) =>
                        updateCompany(
                          index,
                          "default_devis_validity_days",
                          Number(e.target.value || 0)
                        )
                      }
                    />
                  </Field>

                  <Field label="Срок оплаты Facture, дней">
                    <input
                      type="number"
                      value={company.default_invoice_due_days ?? 0}
                      onChange={(e) =>
                        updateCompany(
                          index,
                          "default_invoice_due_days",
                          Number(e.target.value || 0)
                        )
                      }
                    />
                  </Field>

                  <Field label="Предоплата по умолчанию, %">
                    <input
                      type="number"
                      value={company.default_deposit_percent ?? 0}
                      onChange={(e) =>
                        updateCompany(
                          index,
                          "default_deposit_percent",
                          Number(e.target.value || 0)
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Адрес">
                    <textarea
                      value={company.address || ""}
                      onChange={(e) =>
                        updateCompany(index, "address", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Mention TVA">
                    <textarea
                      value={company.vat_mention || ""}
                      onChange={(e) =>
                        updateCompany(index, "vat_mention", e.target.value)
                      }
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => saveCompany(company)}
                  disabled={savingCompanyId === company.id}
                  className="mt-5 rounded-lg bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
                >
                  {savingCompanyId === company.id
                    ? "Сохраняем..."
                    : "Сохранить реквизиты"}
                </button>
              </section>
            ))}
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-6">
            {companies.map((company, index) => (
              <section
                key={company.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <h2 className="text-xl font-bold text-green-400">
                  Тексты документов — {company.name}
                </h2>

                <div className="mt-5 grid gap-4">
                  {[
                    ["invoice_footer", "Дополнительный текст Facture"],
                    ["devis_footer", "Дополнительный текст Devis"],
                    ["work_order_footer", "Дополнительный текст заказ-наряда"],
                    ["payment_terms", "Условия оплаты"],
                    ["warranty_terms", "Гарантийные условия"],
                    ["late_penalty_terms", "Пени за просрочку"],
                    ["recovery_terms", "Условия взыскания"],
                    ["custom_legal_text", "Дополнительный юридический текст"],
                  ].map(([field, label]) => (
                    <Field key={field} label={label}>
                      <textarea
                        className="min-h-28"
                        value={String(company[field as keyof Company] || "")}
                        onChange={(e) =>
                          updateCompany(
                            index,
                            field as keyof Company,
                            e.target.value
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => saveCompany(company)}
                  disabled={savingCompanyId === company.id}
                  className="mt-5 rounded-lg bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-50"
                >
                  {savingCompanyId === company.id
                    ? "Сохраняем..."
                    : "Сохранить тексты"}
                </button>
              </section>
            ))}
          </div>
        )}

        {tab === "numbering" && (
          <SettingsSection title="Нумерация документов">
            <div className="grid gap-4 md:grid-cols-2">
              <TextSetting
                label="Префикс Facture"
                value={settings.invoice_prefix}
                onChange={(value) => updateSettings("invoice_prefix", value)}
              />
              <TextSetting
                label="Формат Facture"
                value={settings.invoice_number_format}
                onChange={(value) =>
                  updateSettings("invoice_number_format", value)
                }
              />
              <TextSetting
                label="Префикс Devis"
                value={settings.devis_prefix}
                onChange={(value) => updateSettings("devis_prefix", value)}
              />
              <TextSetting
                label="Формат Devis"
                value={settings.devis_number_format}
                onChange={(value) =>
                  updateSettings("devis_number_format", value)
                }
              />
              <TextSetting
                label="Префикс заказ-наряда"
                value={settings.work_order_prefix}
                onChange={(value) => updateSettings("work_order_prefix", value)}
              />
              <TextSetting
                label="Формат заказ-наряда"
                value={settings.work_order_number_format}
                onChange={(value) =>
                  updateSettings("work_order_number_format", value)
                }
              />
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Доступные переменные: {"{PREFIX}"}, {"{YYYY}"}, {"{YY}"},{" "}
              {"{MM}"}, {"{DD}"}, {"{SEQ3}"}, {"{SEQ4}"}, {"{SEQ6}"}.
            </p>
          </SettingsSection>
        )}

        {tab === "garage" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ListEditor
              title="Механики"
              value={arrayToText(settings.mechanics)}
              onChange={(value) =>
                updateSettings("mechanics", csvToArray(value))
              }
            />
            <ListEditor
              title="Посты / подъёмники"
              value={arrayToText(settings.lifts)}
              onChange={(value) => updateSettings("lifts", csvToArray(value))}
            />
            <ListEditor
              title="Статусы заказ-наряда"
              value={arrayToText(settings.work_order_statuses)}
              onChange={(value) =>
                updateSettings("work_order_statuses", csvToArray(value))
              }
            />

            <SettingsSection title="Рабочие часы">
              <div className="grid gap-3">
                {Object.entries(settings.opening_hours).map(([day, value]) => (
                  <div
                    key={day}
                    className="grid grid-cols-[140px_1fr] items-center gap-3"
                  >
                    <span className="text-sm text-zinc-400">{day}</span>
                    <input
                      className="rounded bg-zinc-950 p-3"
                      value={value}
                      onChange={(e) =>
                        updateSettings("opening_hours", {
                          ...settings.opening_hours,
                          [day]: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </SettingsSection>
          </div>
        )}

        {tab === "finance" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsSection title="Основные параметры">
              <div className="grid gap-4">
                <Field label="Компания по умолчанию">
                  <select
                    value={settings.default_seller}
                    onChange={(e) =>
                      updateSettings("default_seller", e.target.value)
                    }
                  >
                    {companyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Язык документов по умолчанию">
                  <select
                    value={settings.default_document_language}
                    onChange={(e) =>
                      updateSettings(
                        "default_document_language",
                        e.target.value
                      )
                    }
                  >
                    <option value="fr">Français</option>
                    <option value="ru">Русский</option>
                  </select>
                </Field>
              </div>
            </SettingsSection>

            <ListEditor
              title="Способы оплаты"
              value={arrayToText(settings.payment_methods)}
              onChange={(value) =>
                updateSettings("payment_methods", csvToArray(value))
              }
            />
          </div>
        )}

        {tab === "reminders" && (
          <SettingsSection title="Автоматические напоминания">
            <div className="grid gap-4 md:grid-cols-3">
              <NumberSetting
                label="Напоминание о сервисе, дней"
                value={settings.reminders.service_days}
                onChange={(value) =>
                  updateSettings("reminders", {
                    ...settings.reminders,
                    service_days: value,
                  })
                }
              />
              <NumberSetting
                label="Неоплаченная Facture, дней"
                value={settings.reminders.unpaid_invoice_days}
                onChange={(value) =>
                  updateSettings("reminders", {
                    ...settings.reminders,
                    unpaid_invoice_days: value,
                  })
                }
              />
              <NumberSetting
                label="Машина готова, дней"
                value={settings.reminders.vehicle_ready_days}
                onChange={(value) =>
                  updateSettings("reminders", {
                    ...settings.reminders,
                    vehicle_ready_days: value,
                  })
                }
              />
            </div>
          </SettingsSection>
        )}

        {tab === "ai" && (
          <SettingsSection title="AI-перевод">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg bg-zinc-950 p-4">
                <input
                  type="checkbox"
                  checked={settings.ai.enabled}
                  onChange={(e) =>
                    updateSettings("ai", {
                      ...settings.ai,
                      enabled: e.target.checked,
                    })
                  }
                />
                AI-перевод включён
              </label>

              <TextSetting
                label="Модель"
                value={settings.ai.model}
                onChange={(value) =>
                  updateSettings("ai", { ...settings.ai, model: value })
                }
              />

              <TextSetting
                label="Язык перевода"
                value={settings.ai.target_language}
                onChange={(value) =>
                  updateSettings("ai", {
                    ...settings.ai,
                    target_language: value,
                  })
                }
              />

              <TextSetting
                label="Стиль перевода"
                value={settings.ai.translation_style}
                onChange={(value) =>
                  updateSettings("ai", {
                    ...settings.ai,
                    translation_style: value,
                  })
                }
              />
            </div>

            <p className="mt-4 text-sm text-yellow-400">
              API-ключ OpenAI здесь не хранится. Он должен оставаться только в
              серверном `.env.local`.
            </p>
          </SettingsSection>
        )}

        {tab === "appearance" && (
          <SettingsSection title="Внешний вид">
            <div className="grid gap-4 md:grid-cols-2">
              <TextSetting
                label="Название CRM"
                value={settings.appearance.company_title}
                onChange={(value) =>
                  updateSettings("appearance", {
                    ...settings.appearance,
                    company_title: value,
                  })
                }
              />

              <Field label="Акцентный цвет">
                <select
                  value={settings.appearance.accent}
                  onChange={(e) =>
                    updateSettings("appearance", {
                      ...settings.appearance,
                      accent: e.target.value,
                    })
                  }
                >
                  <option value="green">Зелёный</option>
                  <option value="blue">Синий</option>
                  <option value="orange">Оранжевый</option>
                  <option value="red">Красный</option>
                  <option value="purple">Фиолетовый</option>
                </select>
              </Field>

              <label className="flex items-center gap-3 rounded-lg bg-zinc-950 p-4">
                <input
                  type="checkbox"
                  checked={settings.appearance.compact_mode}
                  onChange={(e) =>
                    updateSettings("appearance", {
                      ...settings.appearance,
                      compact_mode: e.target.checked,
                    })
                  }
                />
                Компактный режим
              </label>
            </div>
          </SettingsSection>
        )}
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold text-green-400">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="[&_input]:w-full [&_input]:rounded [&_input]:bg-zinc-950 [&_input]:p-3 [&_select]:w-full [&_select]:rounded [&_select]:bg-zinc-950 [&_select]:p-3 [&_textarea]:w-full [&_textarea]:rounded [&_textarea]:bg-zinc-950 [&_textarea]:p-3">
        {children}
      </div>
    </label>
  );
}

function TextSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function NumberSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </Field>
  );
}

function ListEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsSection title={title}>
      <textarea
        className="min-h-64 w-full rounded bg-zinc-950 p-4"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Одна строка — один пункт"
      />
      <p className="mt-2 text-xs text-zinc-500">
        Одна строка — один пункт.
      </p>
    </SettingsSection>
  );
}