import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ className, caption, children }: { className?: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className={cn("border-line overflow-x-auto rounded-lg border bg-white", className)}>
      <table className="w-full border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}
export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="text-ink-muted bg-slate-100 text-xs tracking-wide uppercase" {...props} />;
}
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("px-3 py-2.5 font-semibold whitespace-nowrap", className)} {...props} />;
}
export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-line border-t px-3 py-2.5 align-top", className)} {...props} />;
}
