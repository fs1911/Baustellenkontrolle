"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { APP_ROLES, ROLE_LABEL } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { addMembershipAction, addRoleAction, createUserAction, removeMembershipAction, removeRoleAction, setUserActiveAction } from "@/app/(app)/admin/actions";

type Result = { ok: boolean; error?: string; message?: string };
function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<Result>) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? "Gespeichert." : r.error ?? "Fehler", r.ok ? "success" : "error");
    if (r.ok) router.refresh();
  });
  return { pending, run };
}

export interface UserRow {
  id: string; fullName: string; email: string; jobTitle: string | null; isActive: boolean;
  roles: { id: string; role: string; companyName: string | null }[];
  memberships: { id: string; siteName: string; role: string }[];
}

export function UserCard({ u, companies, sites }: { u: UserRow; companies: { id: string; name: string }[]; sites: { id: string; name: string }[] }) {
  const { pending, run } = useRun();
  const [role, setRole] = useState<string>("project_manager");
  const [company, setCompany] = useState<string>(companies[0]?.id ?? "");
  const [site, setSite] = useState<string>(sites[0]?.id ?? "");
  const [siteRole, setSiteRole] = useState<string>("project_manager");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {u.roles.map((r) => (
          <Tag key={r.id}>{ROLE_LABEL[r.role as keyof typeof ROLE_LABEL]} · {r.companyName ?? "gruppenweit"}
            <button type="button" className="ml-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded hover:bg-slate-200" aria-label={`Rolle ${r.role} entfernen`} onClick={() => run(() => removeRoleAction(r.id))}><Trash2 className="size-4" aria-hidden /></button>
          </Tag>
        ))}
        {u.roles.length === 0 && <span className="text-sm text-ink-muted">Keine Rolle</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Rolle" htmlFor={`r-${u.id}`}><Select id={`r-${u.id}`} value={role} onChange={(e) => setRole(e.target.value)}>{APP_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        <Field label="Geltungsbereich" htmlFor={`rc-${u.id}`}>
          <Select id={`rc-${u.id}`} value={company} onChange={(e) => setCompany(e.target.value)}>
            {["admin", "group_ims", "viewer"].includes(role) && <option value="">Gruppenweit</option>}
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Button className="self-end" loading={pending} onClick={() => run(() => addRoleAction({ userId: u.id, role, companyId: company || null }))}>Rolle zuweisen</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {u.memberships.map((m) => (
          <Tag key={m.id}>{m.siteName} · {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]}
            <button type="button" className="ml-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded hover:bg-slate-200" aria-label={`Zuordnung ${m.siteName} entfernen`} onClick={() => run(() => removeMembershipAction(m.id))}><Trash2 className="size-4" aria-hidden /></button>
          </Tag>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Baustelle" htmlFor={`s-${u.id}`}><Select id={`s-${u.id}`} value={site} onChange={(e) => setSite(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Funktion auf Baustelle" htmlFor={`sr-${u.id}`}><Select id={`sr-${u.id}`} value={siteRole} onChange={(e) => setSiteRole(e.target.value)}>{(["project_manager", "site_foreman", "viewer"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        <Button className="self-end" variant="outline" loading={pending} onClick={() => run(() => addMembershipAction({ userId: u.id, siteId: site, role: siteRole }))}>Zuordnen</Button>
      </div>
      <Button variant={u.isActive ? "outline" : "success"} size="sm" loading={pending} onClick={() => run(() => setUserActiveAction(u.id, !u.isActive))}>{u.isActive ? "Konto deaktivieren" : "Konto aktivieren"}</Button>
    </div>
  );
}

export function CreateUserForm({ localAuth }: { localAuth: boolean }) {
  const [v, setV] = useState({ fullName: "", email: "", jobTitle: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {error && <Alert tone="error" className="md:col-span-2">{error}</Alert>}
      <Field label="Name" htmlFor="nu-name" required><Input id="nu-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} /></Field>
      <Field label="Geschäftliche E-Mail-Adresse" htmlFor="nu-mail" required><Input id="nu-mail" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label="Funktion" htmlFor="nu-title"><Input id="nu-title" value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} /></Field>
      {localAuth ? (
        <Field label="Initialpasswort (min. 12 Zeichen)" htmlFor="nu-pw" required><Input id="nu-pw" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
      ) : <p className="self-end text-sm text-ink-muted">Der Benutzer erhält eine Einladung per E-Mail (Supabase Auth).</p>}
      <div><Button loading={pending} onClick={() => start(async () => {
        setError(null);
        const r = await createUserAction(v);
        if (!r.ok) return setError(r.error);
        toast(r.message ?? "Angelegt.");
        setV({ fullName: "", email: "", jobTitle: "", password: "" });
        router.refresh();
      })}>Benutzer anlegen</Button></div>
    </div>
  );
}
