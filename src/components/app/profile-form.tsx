"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { exportMyDataAction, saveProfileAction } from "@/app/(app)/profil/actions";

export function ProfileForm({
  initial,
}: {
  initial: {
    fullName: string;
    jobTitle: string;
    phone: string;
    email: string;
    emailOnAssignment: boolean;
    emailOnOverdue: boolean;
    weeklyDigest: boolean;
  };
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name" htmlFor="p-name">
        <Input id="p-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
      </Field>
      <Field label="Geschäftliche E-Mail-Adresse" htmlFor="p-mail" hint="Änderung durch die Administration">
        <Input id="p-mail" value={v.email} disabled />
      </Field>
      <Field label="Funktion" htmlFor="p-title">
        <Input id="p-title" value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} />
      </Field>
      <Field label="Telefon" htmlFor="p-phone">
        <Input id="p-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-semibold">Benachrichtigungen (Vorbereitung, Versand nach Aktivierung des Mailproviders)</legend>
        <Checkbox
          id="n-assign"
          label="E-Mail bei Zuweisung einer Massnahme"
          checked={v.emailOnAssignment}
          onChange={(e) => setV({ ...v, emailOnAssignment: e.target.checked })}
        />
        <Checkbox
          id="n-overdue"
          label="E-Mail bei überfälliger Massnahme"
          checked={v.emailOnOverdue}
          onChange={(e) => setV({ ...v, emailOnOverdue: e.target.checked })}
        />
        <Checkbox
          id="n-digest"
          label="Wöchentliche Zusammenfassung"
          checked={v.weeklyDigest}
          onChange={(e) => setV({ ...v, weeklyDigest: e.target.checked })}
        />
      </fieldset>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveProfileAction(v);
              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
            })
          }
        >
          Speichern
        </Button>
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await exportMyDataAction();
              if (!r.ok) return toast(r.error, "error");
              const url = URL.createObjectURL(new Blob([r.data], { type: "application/json" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "meine-daten.json";
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          Meine Daten exportieren (Auskunft)
        </Button>
      </div>
    </div>
  );
}
