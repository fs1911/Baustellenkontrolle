"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3, Building2, ClipboardCheck, FileText, HardHat, LayoutDashboard, ListChecks, LogOut, Menu, Plus, Repeat, Search, Settings, ShieldCheck, UserCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NavIcon, NavItem } from "./nav-config";
import { ConnectivityBanner } from "./connectivity";
import { logoutAction } from "@/app/login/actions";

const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, inspections: ClipboardCheck, actions: ListChecks, findings: Search, recurring: Repeat,
  sites: Building2, reports: FileText, management: BarChart3, admin: ShieldCheck, settings: Settings,
};

export function AppShell({ items, user, canCreate, children }: { items: NavItem[]; user: { name: string; roleLabel: string }; canCreate: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const primaryMobile = items.filter((i) => ["/dashboard", "/kontrollen", "/massnahmen"].includes(i.href)).slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Zum Inhalt springen</a>

      {/* Desktop-Navigation */}
      <aside className="no-print hidden w-64 shrink-0 flex-col bg-chrome text-slate-200 md:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 text-white">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand"><HardHat className="size-6" aria-hidden /></span>
          <span className="leading-tight"><span className="block font-bold">Baustellenkontrolle</span><span className="text-xs text-slate-400">tozzo gruppe ag</span></span>
        </Link>
        {canCreate && (
          <div className="px-4 pb-3">
            <Link href="/kontrollen/neu" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-strong">
              <Plus className="size-5" aria-hidden /> Neue Kontrolle
            </Link>
          </div>
        )}
        <nav aria-label="Hauptnavigation" className="flex-1 space-y-0.5 px-3">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium",
                  isActive(item.href) ? "bg-white/15 text-white" : "hover:bg-white/10 hover:text-white")}>
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link href="/profil" className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-white/10">
            <UserCircle className="size-6 shrink-0" aria-hidden />
            <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold text-white">{user.name}</span><span className="block truncate text-xs text-slate-400">{user.roleLabel}</span></span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-white/10">
              <LogOut className="size-5" aria-hidden /> Abmelden
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Kopfzeile */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-chrome px-3 py-2 text-white md:hidden" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand"><HardHat className="size-5" aria-hidden /></span>
          Baustellenkontrolle
        </Link>
        <button type="button" className="touch-target inline-flex items-center justify-center rounded-lg" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen" aria-expanded={menuOpen}>
          <Menu className="size-7" aria-hidden />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)}>
          <nav aria-label="Menü" className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-chrome text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-semibold">{user.name}</span>
              <button type="button" className="touch-target inline-flex items-center justify-center" onClick={() => setMenuOpen(false)} aria-label="Menü schliessen"><X className="size-7" aria-hidden /></button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-3">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-base", isActive(item.href) ? "bg-white/15 text-white" : "hover:bg-white/10")}>
                    <Icon className="size-5" aria-hidden /> {item.label}
                  </Link>
                );
              })}
              <Link href="/profil" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-white/10"><UserCircle className="size-5" aria-hidden /> Profil</Link>
            </div>
            <form action={logoutAction} className="border-t border-white/10 p-3">
              <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 hover:bg-white/10"><LogOut className="size-5" aria-hidden /> Abmelden</button>
            </form>
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectivityBanner />
        <main id="inhalt" className="mx-auto w-full max-w-7xl flex-1 px-3 pt-4 pb-28 sm:px-5 md:px-8 md:pt-8 md:pb-10">{children}</main>
      </div>

      {/* Mobile Tab-Leiste */}
      <nav aria-label="Schnellnavigation" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {primaryMobile.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold", isActive(item.href) ? "text-brand" : "text-ink-muted")}>
              <Icon className="size-6" aria-hidden />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
        {canCreate ? (
          <Link href="/kontrollen/neu" className="flex min-h-16 flex-col items-center justify-center gap-0.5 bg-brand text-xs font-semibold text-white">
            <Plus className="size-7" aria-hidden /> Neu
          </Link>
        ) : (
          <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-ink-muted">
            <Menu className="size-6" aria-hidden /> Mehr
          </button>
        )}
      </nav>
    </div>
  );
}
