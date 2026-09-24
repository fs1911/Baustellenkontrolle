import "server-only";
import { z } from "zod";

/**
 * Serverseitige Konfiguration. Alle Integrationen haben einen lokalen Fallback, damit der
 * Entwicklungsmodus ohne produktive E-Mail-, KI- oder Supabase-Zugangsdaten läuft.
 */
const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),

    AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET muss mindestens 32 Zeichen lang sein"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    AUTH_ENABLE_AZURE: z.enum(["true", "false"]).default("false"),

    STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default(".data/storage"),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

    MAIL_PROVIDER: z.enum(["sandbox", "smtp", "graph"]).default("sandbox"),
    MAIL_FROM_ADDRESS: z.string().email().default("baustellenkontrolle@example.ch"),
    MAIL_SANDBOX_DIR: z.string().default(".data/mail-sandbox"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: z.enum(["true", "false"]).default("true"),
    GRAPH_TENANT_ID: z.string().optional(),
    GRAPH_CLIENT_ID: z.string().optional(),
    GRAPH_CLIENT_SECRET: z.string().optional(),
    GRAPH_SENDER_MAILBOX: z.string().optional(),

    AI_PROVIDER: z.enum(["rules", "anthropic"]).default("rules"),
    AI_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),

    CRON_SECRET: z.string().optional(),

    /** "sharp" (Node.js, volle Verarbeitung) oder "basic" (Cloudflare Workers, ohne native Bibliothek). */
    IMAGE_PROCESSING: z.enum(["sharp", "basic"]).default("sharp"),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_PROVIDER === "supabase" || env.STORAGE_PROVIDER === "supabase") {
      if (!env.NEXT_PUBLIC_SUPABASE_URL) ctx.addIssue({ code: "custom", message: "NEXT_PUBLIC_SUPABASE_URL fehlt" });
    }
    if (env.AUTH_PROVIDER === "supabase" && !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      ctx.addIssue({ code: "custom", message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt" });
    }
    if (env.STORAGE_PROVIDER === "supabase" && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: "custom", message: "SUPABASE_SERVICE_ROLE_KEY fehlt" });
    }
    if (env.APP_ENV === "production") {
      if (env.AUTH_PROVIDER === "local") ctx.addIssue({ code: "custom", message: "In Produktion ist AUTH_PROVIDER=supabase erforderlich" });
      if (env.MAIL_PROVIDER === "sandbox")
        ctx.addIssue({ code: "custom", message: "In Produktion ist ein echter MAIL_PROVIDER erforderlich" });
      if (env.STORAGE_PROVIDER === "local")
        ctx.addIssue({ code: "custom", message: "In Produktion ist STORAGE_PROVIDER=supabase erforderlich" });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

function parseEnv() {
  // Leere Werte aus .env-Dateien gelten als "nicht gesetzt".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""));
  return schema.safeParse(raw);
}

/** Konfigurationsprobleme als Liste (nur Namen und Meldungen, nie Werte) – für die Diagnoseseite. */
export function configIssues(): string[] {
  const parsed = parseEnv();
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`);
}

export function env(): ServerEnv {
  if (!cached) {
    const parsed = parseEnv();
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `- ${i.path.join(".") || "config"}: ${i.message}`).join("\n");
      console.error(`Ungültige Konfiguration:\n${details}`);
      throw new Error(`Ungültige Konfiguration:\n${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().APP_ENV === "production";
