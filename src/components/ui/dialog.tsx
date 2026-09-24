"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Barrierearmer Modal-Dialog auf Basis des nativen <dialog>-Elements (Fokusfalle, Escape). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="border-line m-auto w-[min(640px,calc(100vw-1.5rem))] rounded-[var(--radius-card)] border p-0 shadow-2xl backdrop:bg-black/50"
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-line flex items-center justify-between gap-3 border-b px-5 py-3">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="touch-target -mr-2 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
              aria-label="Dialog schliessen"
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-line flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
