import { ACTION_STATUSES, ACTION_STATUS_LABEL, INSPECTION_TYPES, INSPECTION_TYPE_LABEL, RISK_LEVELS, RISK_LABEL } from "@/lib/domain/enums";
import type { DashboardFilters } from "@/lib/repositories/dashboard";
import { FilterBar, FilterInput, FilterSelect } from "./filter-bar";

export function DashboardFilterBar({
  f,
  options,
  resetHref,
}: {
  f: DashboardFilters;
  options: {
    companies: { id: string; name: string }[];
    sites: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    inspectors: { id: string; name: string }[];
    roles: string[];
  };
  resetHref: string;
}) {
  return (
    <FilterBar resetHref={resetHref}>
      <FilterInput name="von" label="Von" type="date" value={f.from} />
      <FilterInput name="bis" label="Bis" type="date" value={f.to} />
      <FilterSelect
        name="gesellschaft"
        label="Gesellschaft"
        value={f.companyId}
        options={options.companies.map((c) => ({ value: c.id, label: c.name }))}
      />
      <FilterSelect
        name="baustelle"
        label="Baustelle / Projekt"
        value={f.siteId}
        options={options.sites.map((s) => ({ value: s.id, label: s.name }))}
      />
      <FilterSelect
        name="typ"
        label="Kontrolltyp"
        value={f.type}
        options={INSPECTION_TYPES.map((t) => ({ value: t, label: INSPECTION_TYPE_LABEL[t] }))}
      />
      <FilterSelect
        name="kategorie"
        label="Kategorie"
        value={f.categoryId}
        options={options.categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <FilterSelect
        name="risiko"
        label="Risikostufe"
        value={f.riskLevel}
        options={RISK_LEVELS.map((r) => ({ value: r, label: RISK_LABEL[r] }))}
      />
      <FilterSelect
        name="status"
        label="Status"
        value={f.status}
        options={ACTION_STATUSES.map((s) => ({ value: s, label: ACTION_STATUS_LABEL[s] }))}
      />
      <FilterSelect
        name="rolle"
        label="Verantwortliche Rolle"
        value={f.responsibleRole}
        options={options.roles.map((r) => ({ value: r, label: r }))}
      />
      <FilterSelect
        name="kontrolleur"
        label="Kontrollierende Person"
        value={f.inspectorId}
        options={options.inspectors.map((i) => ({ value: i.id, label: i.name }))}
      />
    </FilterBar>
  );
}
