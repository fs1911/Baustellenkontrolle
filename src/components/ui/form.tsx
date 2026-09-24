import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const control =
  "block w-full rounded-lg border-2 border-line-strong bg-white px-3 text-base text-ink placeholder:text-ink-subtle " +
  "focus:border-info focus:outline-none disabled:bg-slate-100 aria-[invalid=true]:border-negative";

export function Field({
  label, htmlFor, error, hint, required, children, className,
}: { label: ReactNode; htmlFor: string; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-negative" aria-hidden> *</span>}
        {required && <span className="sr-only"> (Pflichtfeld)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-muted" id={`${htmlFor}-hint`}>{hint}</p>}
      {error && (
        <p className="text-sm font-semibold text-negative" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "min-h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, "py-2.5", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "min-h-12 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ label, id, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 text-base", className)}>
      <input id={id} type="checkbox" className="size-6 shrink-0 accent-[var(--color-brand)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Grosse Auswahlkacheln (z. B. Beurteilung, Risikostufe) – gut mit Handschuhen bedienbar. */
export function ChoiceGroup<T extends string>({
  name, value, onChange, options, legend, columns = 3, error,
}: {
  name: string;
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode; activeClass: string }[];
  legend: string;
  columns?: 2 | 3 | 4;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold text-ink">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")} role="radiogroup">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-center text-sm font-semibold transition-colors",
                active ? o.activeClass : "border-line-strong bg-white text-ink hover:bg-slate-50",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.icon}
              <span>{o.label}</span>
              {active && <span className="sr-only">(ausgewählt)</span>}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1 text-sm font-semibold text-negative" role="alert">{error}</p>}
    </fieldset>
  );
}
