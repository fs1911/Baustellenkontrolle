import type { ReactNode } from "react";
import { AlertOctagon, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "error";
const tones: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-blue-300 bg-info-soft text-blue-950", Icon: Info },
  success: { cls: "border-green-300 bg-positive-soft text-green-950", Icon: CheckCircle2 },
  warning: { cls: "border-amber-300 bg-improve-soft text-amber-950", Icon: TriangleAlert },
  error: { cls: "border-red-300 bg-negative-soft text-red-950", Icon: AlertOctagon },
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border-2 px-4 py-3", t.cls, className)} role={tone === "error" ? "alert" : "status"}>
      <t.Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-white px-6 py-10 text-center">
      {icon && <div className="text-ink-subtle">{icon}</div>}
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="max-w-md text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Inhalt wird geladen">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 space-y-2">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-sm text-ink-muted">{i.label}</dt>
          <dd className="font-medium break-words">{i.value || "–"}</dd>
        </div>
      ))}
    </dl>
  );
}
