/** Fachliche Aufzählungen inkl. Schweizer Hochdeutsch-Beschriftungen. Spiegeln die DB-Enums. */

export const ASSESSMENTS = ["positive", "negative", "improvement"] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const ASSESSMENT_LABEL: Record<Assessment, string> = {
  positive: "Positiv",
  negative: "Abweichung",
  improvement: "Verbesserungsmöglichkeit",
};

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};
export const RISK_WEIGHT: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export const ACTION_STATUSES = ["open", "in_progress", "resolved", "verified", "closed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Behoben",
  verified: "Verifiziert",
  closed: "Geschlossen",
};
export const OPEN_ACTION_STATUSES: readonly ActionStatus[] = ["open", "in_progress"];

export const INSPECTION_TYPES = ["routine", "unannounced", "follow_up", "acceptance", "ims_audit", "special"] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];
export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  routine: "Routinekontrolle",
  unannounced: "Unangemeldete Kontrolle",
  follow_up: "Nachkontrolle",
  acceptance: "Begehung / Abnahme",
  ims_audit: "IMS-Begehung",
  special: "Sonderkontrolle",
};

export const INSPECTION_STATUSES = ["draft", "completed", "archived"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "In Erfassung",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

export const REPORT_STATUSES = ["draft", "in_review", "released", "sent", "send_failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Entwurf",
  in_review: "In Prüfung",
  released: "Freigegeben",
  sent: "Versendet",
  send_failed: "Versand fehlgeschlagen",
};

export const DELIVERY_STATUS_LABEL = {
  queued: "In Warteschlange",
  sending: "Wird gesendet",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
} as const;
export type DeliveryStatus = keyof typeof DELIVERY_STATUS_LABEL;

export const APP_ROLES = ["admin", "group_ims", "project_manager", "site_foreman", "viewer"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  group_ims: "Gruppen-IMS / SIBE",
  project_manager: "Projektleiter / Bauleiter",
  site_foreman: "Polier / Baustellenverantwortlicher",
  viewer: "Lesend / Management",
};

export const REFERENCE_TYPES = [
  "bauav", "vuv", "argv", "ekas", "suva_checklist", "suva_vital_rule",
  "iso_45001", "iso_9001", "iso_14001", "sia", "internal", "project", "other",
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];
export const REFERENCE_TYPE_LABEL: Record<ReferenceType, string> = {
  bauav: "BauAV",
  vuv: "VUV",
  argv: "ArGV",
  ekas: "EKAS-Richtlinie",
  suva_checklist: "Suva-Checkliste",
  suva_vital_rule: "Suva – Lebenswichtige Regeln",
  iso_45001: "ISO 45001",
  iso_9001: "ISO 9001",
  iso_14001: "ISO 14001",
  sia: "SIA-Norm",
  internal: "Interne Weisung",
  project: "Projektspezifische Vorgabe",
  other: "Andere",
};

export const REVIEW_STATUS_LABEL = {
  to_review: "Zu prüfen",
  approved: "Geprüft und freigegeben",
  retired: "Ausser Kraft",
} as const;
export type ReviewStatus = keyof typeof REVIEW_STATUS_LABEL;
