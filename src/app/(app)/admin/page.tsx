import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, History, Mail, Settings, Users } from "lucide-react";
import { requireCatalogEditor } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Verwaltung" };

export default async function AdminPage() {
  const user = await requireCatalogEditor();
  const admin = user.permissions.is_admin;
  const tiles = [
    { href: "/admin/gesellschaften", label: "Gesellschaften, Logos und Branding", desc: "Stammdaten, Logo, Farbe, Verteiler, Disclaimer", Icon: Building2, show: admin },
    { href: "/admin/katalog", label: "Kategorien und Referenzkatalog", desc: "Kategorien, Schlagworte, Muster-Massnahmen, Referenzen mit Prüfprozess", Icon: BookOpen, show: true },
    { href: "/admin/benutzer", label: "Benutzer und Rollen", desc: "Konten, Rollen, Baustellenzuordnungen", Icon: Users, show: admin },
    { href: "/admin/einstellungen", label: "Einstellungen", desc: "KI, Bilddaten, Aufbewahrung, Scoring, Berichtstexte", Icon: Settings, show: admin },
    { href: "/admin/audit", label: "Audit-Log", desc: "Nachvollziehbarkeit aller wesentlichen Änderungen", Icon: History, show: admin },
    { href: "/admin/mail-sandbox", label: "Mail-Sandbox", desc: "Im Entwicklungsmodus versendete E-Mails", Icon: Mail, show: admin },
  ].filter((t) => t.show);
  return (
    <>
      <PageHeader title="Verwaltung" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] hover:border-line-strong">
            <t.Icon className="size-8 shrink-0 text-brand" aria-hidden />
            <span><span className="block text-lg font-semibold">{t.label}</span><span className="text-sm text-ink-muted">{t.desc}</span></span>
          </Link>
        ))}
      </div>
    </>
  );
}
