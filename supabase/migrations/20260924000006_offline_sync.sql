-- Idempotente Synchronisation offline erfasster Feststellungen (PWA).
alter table public.findings add column client_ref uuid;
create unique index findings_client_ref_idx on public.findings (client_ref) where client_ref is not null;
alter table public.finding_images add column client_ref uuid;
create unique index finding_images_client_ref_idx on public.finding_images (client_ref) where client_ref is not null;
