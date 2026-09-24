"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { SiteDialog } from "@/components/forms/site-dialog";

export function NewSiteButton({ companies }: { companies: { id: string; name: string }[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (companies.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      {companies.length > 1 && (
        <Select aria-label="Gesellschaft für neue Baustelle" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-auto">
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      <Button onClick={() => setOpen(true)}><Plus className="size-5" aria-hidden /> Neue Baustelle</Button>
      <SiteDialog key={companyId} open={open} onClose={() => setOpen(false)} companyId={companyId} onCreated={() => { toast("Baustelle angelegt."); router.refresh(); }} />
    </div>
  );
}
