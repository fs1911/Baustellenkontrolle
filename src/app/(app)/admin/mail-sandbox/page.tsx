import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listSandboxMails } from "@/lib/services/mail";
import { formatDateTime } from "@/lib/utils/format";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, THead, Th, Td } from "@/components/ui/table";

export const metadata: Metadata = { title: "Mail-Sandbox" };

export default async function MailSandboxPage() {
  await requireAdmin();
  const mails = await listSandboxMails(100);
  return (
    <>
      <PageHeader
        title="Mail-Sandbox"
        description="Im Entwicklungsmodus werden E-Mails nicht zugestellt, sondern als .eml-Datei abgelegt."
      />
      {env().MAIL_PROVIDER !== "sandbox" && (
        <Alert tone="info" className="mb-4">
          Aktiver Versand über «{env().MAIL_PROVIDER}». Die Sandbox zeigt nur ältere Entwicklungs-Mails.
        </Alert>
      )}
      {mails.length === 0 ? (
        <EmptyState title="Noch keine E-Mails" description="Versenden Sie einen Bericht, um hier eine E-Mail zu sehen." />
      ) : (
        <Table caption="Sandbox-E-Mails">
          <THead>
            <tr>
              <Th>Zeitpunkt</Th>
              <Th>Betreff</Th>
              <Th>Empfänger</Th>
              <Th>Anhänge</Th>
              <Th>Datei</Th>
            </tr>
          </THead>
          <tbody>
            {mails.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</Td>
                <Td>{m.subject}</Td>
                <Td className="break-all">
                  {m.to.join(", ")}
                  {m.cc.length > 0 && (
                    <>
                      <br />
                      CC: {m.cc.join(", ")}
                    </>
                  )}
                  {m.bcc.length > 0 && (
                    <>
                      <br />
                      BCC: {m.bcc.join(", ")}
                    </>
                  )}
                </Td>
                <Td>{m.attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(", ")}</Td>
                <Td>
                  <a className="text-info font-semibold underline" href={`/api/admin/mail-sandbox?id=${m.id}`}>
                    .eml
                  </a>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
