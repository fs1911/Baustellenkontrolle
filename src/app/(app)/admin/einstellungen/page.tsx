import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { withUser } from "@/lib/db/client";
import { loadSettings } from "@/lib/repositories/settings";
import { describeAiMode } from "@/lib/services/ai";
import { PageHeader } from "@/components/ui/feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue } from "@/components/ui/feedback";
import { SettingsForms } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  const settings = await withUser(user.id, (tx) => loadSettings(tx));
  const e = env();
  return (
    <>
      <PageHeader title="Einstellungen" />
      <Card className="mb-5">
        <CardHeader
          title="Integrationen (aus Umgebungsvariablen)"
          description="Secrets werden nie in der Datenbank oder im Code gespeichert."
        />
        <CardBody>
          <KeyValue
            items={[
              { label: "Umgebung", value: e.APP_ENV },
              {
                label: "Anmeldung",
                value:
                  e.AUTH_PROVIDER === "supabase"
                    ? `Supabase Auth${e.AUTH_ENABLE_AZURE === "true" ? " + Microsoft Entra ID" : ""}`
                    : "Lokal (Entwicklung)",
              },
              {
                label: "Dateispeicher",
                value: e.STORAGE_PROVIDER === "supabase" ? "Supabase Storage (private Buckets)" : "Lokales Dateisystem (Entwicklung)",
              },
              {
                label: "E-Mail",
                value: {
                  sandbox: "Sandbox (keine Zustellung)",
                  smtp: `SMTP (${e.SMTP_HOST ?? "nicht konfiguriert"})`,
                  graph: `Microsoft Graph (${e.GRAPH_SENDER_MAILBOX ?? "nicht konfiguriert"})`,
                }[e.MAIL_PROVIDER],
              },
              { label: "KI", value: describeAiMode(settings) },
              { label: "Signierte Links gültig", value: `${e.SIGNED_URL_TTL_SECONDS} Sekunden` },
            ]}
          />
        </CardBody>
      </Card>
      <SettingsForms initial={settings} externalConfigured={e.AI_PROVIDER === "anthropic" && !!e.ANTHROPIC_API_KEY} />
    </>
  );
}
