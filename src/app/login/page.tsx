import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { LoginForm } from "./login-form";
import { loginWithMicrosoftAction } from "./actions";

export const metadata: Metadata = { title: "Anmelden" };

const DEMO = [
  ["admin@tozzo-gruppe.example", "Administrator"],
  ["sibe@tozzo-gruppe.example", "Gruppen-IMS / SIBE"],
  ["s.meier@hochbau.example", "Projektleiterin (Birr, Zürich Nord)"],
  ["l.rossi@tiefbau.example", "Bauleiter Tiefbau"],
  ["b.huber@hochbau.example", "Polier (Birr)"],
  ["gl@tozzo-gruppe.example", "Management (lesend)"],
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const e = env();
  const showDemo = e.APP_ENV !== "production" && e.AUTH_PROVIDER === "local";
  return (
    <main className="bg-chrome flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-3 text-white">
          <span className="bg-brand flex size-12 items-center justify-center rounded-xl">
            <HardHat className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-bold">Baustellenkontrolle</p>
            <p className="text-sm text-slate-300">tozzo gruppe ag</p>
          </div>
        </div>
        <Card>
          <CardBody className="space-y-5">
            <h1 className="text-2xl font-bold">Anmelden</h1>
            {sp.fehler === "sso" && <Alert tone="error">Die Anmeldung mit Microsoft ist fehlgeschlagen. Bitte erneut versuchen.</Alert>}
            <LoginForm next={next} />
            {e.AUTH_PROVIDER === "supabase" && e.AUTH_ENABLE_AZURE === "true" && (
              <form action={loginWithMicrosoftAction}>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Mit Microsoft 365 anmelden
                </Button>
              </form>
            )}
            <p className="text-ink-muted text-sm">
              Mit der Anmeldung nehmen Sie die{" "}
              <Link className="font-semibold underline" href="/datenschutz">
                Datenschutzhinweise
              </Link>{" "}
              zur Kenntnis.
            </p>
          </CardBody>
        </Card>
        {showDemo && (
          <Card>
            <CardBody className="space-y-2 text-sm">
              <p className="font-semibold">
                Demo-Zugänge (nur Entwicklung) – Passwort: <code className="rounded bg-slate-100 px-1">Baustelle!2026</code>
              </p>
              <ul className="space-y-1">
                {DEMO.map(([mail, role]) => (
                  <li key={mail} className="flex flex-wrap justify-between gap-x-3">
                    <code className="text-ink">{mail}</code>
                    <span className="text-ink-muted">{role}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </main>
  );
}
