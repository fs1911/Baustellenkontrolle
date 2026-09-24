"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteSchema, type SiteInput } from "@/lib/domain/validation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { createSiteAction } from "@/app/(app)/kontrollen/actions";

export interface CreatedSite {
  id: string;
  name: string;
  siteNumber: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  companyId: string;
}

export function SiteDialog({
  open,
  onClose,
  companyId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onCreated: (s: CreatedSite) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SiteInput>({
    resolver: zodResolver(siteSchema),
    defaultValues: { companyId, name: "", siteNumber: "", street: "", postalCode: "", city: "", canton: "" },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await createSiteAction({ ...values, companyId });
    if (!res.ok) return setError(res.error);
    onCreated(res.data);
    form.reset();
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Neue Baustelle anlegen"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={submit} loading={form.formState.isSubmitting}>
            Baustelle speichern
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error && (
          <Alert tone="error" className="sm:col-span-2">
            {error}
          </Alert>
        )}
        <Field label="Name der Baustelle" htmlFor="site-name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="site-name" {...form.register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Baustellen- / Projektnummer" htmlFor="site-number" required error={errors.siteNumber?.message}>
          <Input id="site-number" {...form.register("siteNumber")} aria-invalid={!!errors.siteNumber} />
        </Field>
        <Field label="Kanton" htmlFor="site-canton" error={errors.canton?.message} hint="Kürzel, z. B. AG">
          <Input id="site-canton" maxLength={2} {...form.register("canton", { setValueAs: (v: string) => v?.toUpperCase() })} />
        </Field>
        <Field label="Strasse" htmlFor="site-street" className="sm:col-span-2">
          <Input id="site-street" {...form.register("street")} />
        </Field>
        <Field label="PLZ" htmlFor="site-plz">
          <Input id="site-plz" inputMode="numeric" {...form.register("postalCode")} />
        </Field>
        <Field label="Ort" htmlFor="site-city">
          <Input id="site-city" {...form.register("city")} />
        </Field>
      </form>
    </Dialog>
  );
}
