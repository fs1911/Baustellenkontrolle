import { INSPECTION_TYPES, ACTION_STATUSES, RISK_LEVELS } from "@/lib/domain/enums";
import type { DashboardFilters } from "@/lib/repositories/dashboard";
import { dateParam, enumParam, param, uuidParam } from "@/components/app/filter-bar";
import { todayIso } from "./format";

type SP = Record<string, string | string[] | undefined>;

export function parseDashboardFilters(sp: SP, defaultDays = 90): DashboardFilters {
  const to = dateParam(sp, "bis") ?? todayIso();
  const fromDefault = new Date(new Date(`${to}T00:00:00Z`).getTime() - (defaultDays - 1) * 86400000).toISOString().slice(0, 10);
  return {
    companyId: uuidParam(sp, "gesellschaft"),
    siteId: uuidParam(sp, "baustelle"),
    from: dateParam(sp, "von") ?? fromDefault,
    to,
    type: enumParam(sp, "typ", INSPECTION_TYPES),
    categoryId: uuidParam(sp, "kategorie"),
    riskLevel: enumParam(sp, "risiko", RISK_LEVELS),
    status: enumParam(sp, "status", ACTION_STATUSES),
    responsibleRole: param(sp, "rolle"),
    inspectorId: uuidParam(sp, "kontrolleur"),
  };
}

/** Baut Drilldown-Links auf die Feststellungsliste mit denselben Filtern. */
export function findingsLink(f: DashboardFilters, extra: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams();
  const base: Record<string, string | undefined> = {
    gesellschaft: f.companyId,
    baustelle: f.siteId,
    von: f.from,
    bis: f.to,
    kategorie: f.categoryId,
    risiko: f.riskLevel,
    status: f.status,
    rolle: f.responsibleRole,
    kontrolleur: f.inspectorId,
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
  return `/feststellungen?${p.toString()}`;
}
