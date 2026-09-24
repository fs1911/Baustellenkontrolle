import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer, { type SendMailOptions } from "nodemailer";
import { env } from "@/lib/env";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  fromName: string;
  replyTo?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html: string;
  attachments: MailAttachment[];
}

export interface MailResult {
  provider: string;
  messageId: string;
}

export interface MailAdapter {
  readonly name: "sandbox" | "smtp" | "graph";
  send(message: MailMessage): Promise<MailResult>;
}

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Entwicklungs-Mailer: schreibt vollständige .eml-Dateien in MAIL_SANDBOX_DIR (in der App unter Admin → Mail-Sandbox einsehbar). */
class SandboxMailer implements MailAdapter {
  readonly name = "sandbox" as const;
  async send(message: MailMessage): Promise<MailResult> {
    const dir = resolve(/* turbopackIgnore: true */ process.cwd(), env().MAIL_SANDBOX_DIR);
    await mkdir(dir, { recursive: true });
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    const info = await transport.sendMail(toNodemailer(message));
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    await writeFile(join(dir, `${id}.eml`), info.message as Buffer);
    await writeFile(
      join(dir, `${id}.json`),
      JSON.stringify(
        {
          id,
          to: message.to,
          cc: message.cc,
          bcc: message.bcc,
          subject: message.subject,
          attachments: message.attachments.map((a) => ({ filename: a.filename, size: a.content.byteLength })),
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return { provider: this.name, messageId: info.messageId ?? id };
  }
}

class SmtpMailer implements MailAdapter {
  readonly name = "smtp" as const;
  async send(message: MailMessage): Promise<MailResult> {
    const e = env();
    if (!e.SMTP_HOST) throw new MailDeliveryError("SMTP ist nicht konfiguriert.", false);
    const transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT ?? 465,
      secure: e.SMTP_SECURE === "true",
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
    try {
      const info = await transport.sendMail(toNodemailer(message));
      return { provider: this.name, messageId: info.messageId };
    } catch (err) {
      throw new MailDeliveryError(`SMTP-Versand fehlgeschlagen: ${(err as Error).message}`, true);
    }
  }
}

/**
 * Microsoft Graph (Microsoft 365). App-Registrierung mit Application Permission "Mail.Send",
 * eingeschränkt per Application Access Policy auf das Versandpostfach (siehe docs/email-integration.md).
 */
class GraphMailer implements MailAdapter {
  readonly name = "graph" as const;
  private token: { value: string; expires: number } | null = null;

  private async accessToken(): Promise<string> {
    const e = env();
    if (!e.GRAPH_TENANT_ID || !e.GRAPH_CLIENT_ID || !e.GRAPH_CLIENT_SECRET || !e.GRAPH_SENDER_MAILBOX) {
      throw new MailDeliveryError("Microsoft Graph ist nicht vollständig konfiguriert.", false);
    }
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(e.GRAPH_TENANT_ID)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: e.GRAPH_CLIENT_ID,
        client_secret: e.GRAPH_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) throw new MailDeliveryError(`Anmeldung bei Microsoft Graph fehlgeschlagen (${res.status}).`, res.status >= 500);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  async send(message: MailMessage): Promise<MailResult> {
    const total = message.attachments.reduce((s, a) => s + a.content.byteLength, 0);
    if (total > 3 * 1024 * 1024) {
      throw new MailDeliveryError(
        "Anhang grösser als 3 MB – für Graph ist ein Upload-Session-Versand nötig (siehe docs/email-integration.md).",
        false,
      );
    }
    const token = await this.accessToken();
    const addr = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env().GRAPH_SENDER_MAILBOX!)}/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: "HTML", content: message.html },
          toRecipients: addr(message.to),
          ccRecipients: addr(message.cc),
          bccRecipients: addr(message.bcc),
          replyTo: message.replyTo ? addr([message.replyTo]) : undefined,
          attachments: message.attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.filename,
            contentType: a.contentType,
            contentBytes: a.content.toString("base64"),
          })),
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new MailDeliveryError(
        `Graph-Versand fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`,
        res.status === 429 || res.status >= 500,
      );
    }
    return { provider: this.name, messageId: res.headers.get("request-id") ?? randomUUID() };
  }
}

function toNodemailer(m: MailMessage): SendMailOptions {
  return {
    from: { name: m.fromName, address: env().MAIL_FROM_ADDRESS },
    replyTo: m.replyTo,
    to: m.to,
    cc: m.cc.length ? m.cc : undefined,
    bcc: m.bcc.length ? m.bcc : undefined,
    subject: m.subject,
    text: m.text,
    html: m.html,
    attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  };
}

let instance: MailAdapter | undefined;
export function mailer(): MailAdapter {
  if (!instance) {
    const p = env().MAIL_PROVIDER;
    instance = p === "smtp" ? new SmtpMailer() : p === "graph" ? new GraphMailer() : new SandboxMailer();
  }
  return instance;
}

export interface SandboxMailEntry {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  attachments: { filename: string; size: number }[];
  createdAt: string;
}

export async function listSandboxMails(limit = 50): Promise<SandboxMailEntry[]> {
  const dir = resolve(/* turbopackIgnore: true */ process.cwd(), env().MAIL_SANDBOX_DIR);
  let files: string[] = [];
  try {
    files = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8")) as SandboxMailEntry));
}

export async function readSandboxMail(id: string): Promise<Buffer | null> {
  if (!/^[A-Za-z0-9-]+$/.test(id)) return null;
  try {
    return await readFile(join(resolve(/* turbopackIgnore: true */ process.cwd(), env().MAIL_SANDBOX_DIR), `${id}.eml`));
  } catch {
    return null;
  }
}
