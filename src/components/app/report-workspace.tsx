"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Mail, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { AiBadge } from "@/components/ui/badges";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { releaseAndSendAction, saveReportDraftAction, suggestSummaryAction } from "@/app/(app)/kontrollen/[id]/bericht/actions";

export interface RecipientOption {
  email: string;
  label: string;
  defaultChecked: boolean;
}

export function ReportWorkspace({
  inspectionId,
  initialSummary,
  initialClosing,
  recipients,
  allowFree,
  defaultSubject,
  defaultBody,
  mailMode,
  aiMode,
  canEdit,
  isSent,
}: {
  inspectionId: string;
  initialSummary: string;
  initialClosing: string;
  recipients: RecipientOption[];
  allowFree: boolean;
  defaultSubject: string;
  defaultBody: string;
  mailMode: string;
  aiMode: string;
  canEdit: boolean;
  isSent: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState(initialSummary);
  const [closing, setClosing] = useState(initialClosing);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [selected, setSelected] = useState(() => new Set(recipients.filter((r) => r.defaultChecked).map((r) => r.email)));
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDraft = () =>
    start(async () => {
      const r = await saveReportDraftAction(inspectionId, { summaryText: summary, closingText: closing });
      toast(r.ok ? (r.message ?? "Gespeichert.") : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const suggest = () =>
    start(async () => {
      const r = await suggestSummaryAction(inspectionId);
      if (!r.ok) return toast(r.error, "error");
      setSummary(r.data.text);
      setAiSuggested(true);
      toast(`Vorschlag eingefügt${r.data.note ? ` (${r.data.note})` : ""} – bitte prüfen und anpassen.`, "info");
    });

  const toList = [...selected, ...to.split(/[,;\s]+/).filter(Boolean)].join(", ");

  const send = () =>
    start(async () => {
      setError(null);
      const r = await releaseAndSendAction(inspectionId, {
        summaryText: summary,
        closingText: closing,
        to: toList,
        cc,
        bcc,
        subject,
        body,
        confirmed: confirmed as true,
      });
      setConfirmOpen(false);
      setConfirmed(false);
      if (!r.ok) {
        setError(r.error);
        return toast(r.error, "error");
      }
      toast(r.message ?? "Versendet.", r.data.status === "sent" ? "success" : "error");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Texte prüfen und bearbeiten"
          description="Die Management Summary basiert ausschliesslich auf den gespeicherten Kontrolldaten."
        />
        <CardBody className="space-y-4">
          <Field
            label={<span className="flex items-center gap-2">Management Summary {aiSuggested && <AiBadge />}</span>}
            htmlFor="summary"
            hint={`Vorschlagsquelle: ${aiMode}`}
          >
            <Textarea id="summary" rows={7} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="Schlussbemerkung" htmlFor="closing">
            <Textarea id="closing" rows={4} value={closing} onChange={(e) => setClosing(e.target.value)} disabled={!canEdit} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={suggest} loading={pending}>
                <Sparkles className="size-5" aria-hidden /> Summary vorschlagen
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={saveDraft} loading={pending}>
                <Save className="size-5" aria-hidden /> Entwurf speichern
              </Button>
            )}
            <a href={`/api/reports/${inspectionId}/pdf`} target="_blank" rel="noopener" className={buttonClasses("outline")}>
              <FileDown className="size-5" aria-hidden /> PDF-Vorschau (aktueller Stand)
            </a>
          </div>
          <p className="text-ink-muted text-sm">Hinweis: Die PDF-Vorschau verwendet den zuletzt gespeicherten Entwurf.</p>
        </CardBody>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader title="Freigabe und Versand" description={`E-Mail-Versand: ${mailMode}`} />
          <CardBody className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            {isSent && (
              <Alert tone="info">
                Dieser Bericht wurde bereits versendet. Ein erneuter Versand erzeugt eine neue, final protokollierte Version.
              </Alert>
            )}
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-semibold">Empfänger</legend>
              {recipients.map((r) => (
                <Checkbox
                  key={r.email}
                  id={`rcp-${r.email}`}
                  label={
                    <span>
                      {r.label} <span className="text-ink-muted">({r.email})</span>
                    </span>
                  }
                  checked={selected.has(r.email)}
                  onChange={(e) =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(r.email);
                      else n.delete(r.email);
                      return n;
                    })
                  }
                />
              ))}
            </fieldset>
            {allowFree ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Weitere Empfänger (An)" htmlFor="to" hint="Mehrere Adressen mit Komma trennen">
                  <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <Field label="CC" htmlFor="cc">
                  <Input id="cc" value={cc} onChange={(e) => setCc(e.target.value)} />
                </Field>
                <Field label="BCC" htmlFor="bcc">
                  <Input id="bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />
                </Field>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">Freie Empfänger, CC und BCC sind Administration und Gruppen-IMS/SIBE vorbehalten.</p>
            )}
            <Field label="Betreff" htmlFor="subject">
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="E-Mail-Text" htmlFor="body">
              <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Button size="xl" onClick={() => setConfirmOpen(true)} disabled={!toList}>
              <Send className="size-6" aria-hidden /> Bericht freigeben und senden
            </Button>
          </CardBody>
        </Card>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Bericht freigeben und senden?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={send} loading={pending} disabled={!confirmed}>
              <Mail className="size-5" aria-hidden /> Jetzt freigeben und senden
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p>Der Bericht wird als finale Version erzeugt, archiviert (PDF mit Prüfsumme) und an folgende Empfänger gesendet:</p>
          <p className="rounded bg-slate-50 p-2 text-sm font-semibold">
            {toList || "–"}
            {cc && (
              <>
                <br />
                CC: {cc}
              </>
            )}
            {bcc && (
              <>
                <br />
                BCC: {bcc}
              </>
            )}
          </p>
          <Checkbox
            id="confirm-release"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            label="Ich habe den Bericht geprüft und gebe ihn zur Versendung frei."
          />
        </div>
      </Dialog>
    </div>
  );
}

export function RetryButton({ onRetry }: { onRetry: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => start(onRetry)}>
      <RefreshCw className="size-4" aria-hidden /> Erneut senden
    </Button>
  );
}
