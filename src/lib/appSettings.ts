export type AppSettings = {
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
  communications: {
    default_country_code: string;
    appointment_confirmation: string;
    vehicle_ready: string;
    unpaid_invoice: string;
    service_reminder: string;
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

export const defaultAppSettings: AppSettings = {
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
  communications: {
    default_country_code: "+33",
    appointment_confirmation:
      "Bonjour {CLIENT}, votre rendez-vous chez SRV AUTO est confirmé le {DATE} à {TIME} pour votre véhicule {VEHICLE}. Adresse : ZI des 3 Moulins, 282 rue des Cistes, 06600 Antibes.",
    vehicle_ready:
      "Bonjour {CLIENT}, votre véhicule {VEHICLE} est prêt chez SRV AUTO. Vous pouvez venir le récupérer pendant nos horaires d’ouverture.",
    unpaid_invoice:
      "Bonjour {CLIENT}, sauf erreur de notre part, il reste {AMOUNT} à régler pour la facture {DOCUMENT}. Merci de contacter SRV AUTO si nécessaire.",
    service_reminder:
      "Bonjour {CLIENT}, un entretien est recommandé prochainement pour votre véhicule {VEHICLE}. Contactez SRV AUTO pour fixer un rendez-vous.",
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

export function normalizeAppSettings(value: unknown): AppSettings {
  const source = value && typeof value === "object" ? (value as Partial<AppSettings>) : {};

  return {
    ...defaultAppSettings,
    ...source,
    mechanics:
      Array.isArray(source.mechanics) && source.mechanics.length
        ? source.mechanics.filter(Boolean)
        : defaultAppSettings.mechanics,
    lifts:
      Array.isArray(source.lifts) && source.lifts.length
        ? source.lifts.filter(Boolean)
        : defaultAppSettings.lifts,
    payment_methods:
      Array.isArray(source.payment_methods) && source.payment_methods.length
        ? source.payment_methods.filter(Boolean)
        : defaultAppSettings.payment_methods,
    work_order_statuses:
      Array.isArray(source.work_order_statuses) && source.work_order_statuses.length
        ? source.work_order_statuses.filter(Boolean)
        : defaultAppSettings.work_order_statuses,
    opening_hours: {
      ...defaultAppSettings.opening_hours,
      ...(source.opening_hours || {}),
    },
    reminders: {
      ...defaultAppSettings.reminders,
      ...(source.reminders || {}),
    },
    communications: {
      ...defaultAppSettings.communications,
      ...(source.communications || {}),
    },
    ai: {
      ...defaultAppSettings.ai,
      ...(source.ai || {}),
    },
    appearance: {
      ...defaultAppSettings.appearance,
      ...(source.appearance || {}),
    },
  };
}
