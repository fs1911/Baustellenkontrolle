import type { ReactNode } from "react";
import { Filter } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** GET-Formular für Filter (funktioniert ohne JavaScript, Werte bleiben in der URL teilbar). */
export function FilterBar({ children, resetHref, defaultOpen = false }: { children: ReactNode; resetHref: string; defaultOpen?: boolean }) {
  return (
    <details className="group mb-5 rounded-[var(--radius-card)] border border-line bg-white" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold">
        <Filter className="size-5" aria-hidden /> Filter
        <span className="ml-auto text-sm font-normal text-ink-muted group-open:hidden">anzeigen</span>
      </summary>
      <form method="get" className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Anwenden</Button>
          <ButtonLink href={resetHref} variant="outline">Zurücksetzen</ButtonLink>
        </div>
      </form>
    </details>
  );
}

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ""} className="block min-h-12 w-full rounded-lg border-2 border-line-strong bg-white px-3 text-base font-normal">
        <option value="">Alle</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function FilterInput({ name, label, value, type = "text", placeholder }: { name: string; label: string; value?: string; type?: string; placeholder?: string }) {
  return (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="block min-h-12 w-full rounded-lg border-2 border-line-strong bg-white px-3 text-base font-normal" />
    </label>
  );
}

export function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function uuidParam(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = param(sp, key);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined;
}

export function enumParam<T extends string>(sp: Record<string, string | string[] | undefined>, key: string, allowed: readonly T[]): T | undefined {
  const v = param(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function dateParam(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = param(sp, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}
