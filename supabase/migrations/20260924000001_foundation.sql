-- =============================================================================
-- Baustellenkontrolle – Fundament: Extensions, Schema "app", Enums, Hilfsfunktionen
-- Läuft unverändert auf Supabase (gehostet) und auf dem lokalen supabase/postgres-Image.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Internes Schema für Hilfsfunktionen (wird nicht über PostgREST exponiert).
create schema if not exists app;
grant usage on schema app to authenticated, service_role;
revoke all on schema app from anon;

-- -----------------------------------------------------------------------------
-- Enums (validierte Statuswerte)
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'admin',            -- Administrator
  'group_ims',        -- Gruppen-IMS / SIBE
  'project_manager',  -- Projektleiter / Bauleiter
  'site_foreman',     -- Polier / Baustellenverantwortlicher
  'viewer'            -- Lesender Benutzer / Management
);

create type public.assessment as enum ('positive', 'negative', 'improvement');
create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
create type public.action_status as enum ('open', 'in_progress', 'resolved', 'verified', 'closed');
create type public.inspection_status as enum ('draft', 'completed', 'archived');
create type public.inspection_type as enum (
  'routine', 'unannounced', 'follow_up', 'acceptance', 'ims_audit', 'special'
);
create type public.report_status as enum ('draft', 'in_review', 'released', 'sent', 'send_failed');
create type public.delivery_status as enum ('queued', 'sending', 'sent', 'failed');
create type public.reference_type as enum (
  'bauav', 'vuv', 'argv', 'ekas', 'suva_checklist', 'suva_vital_rule',
  'iso_45001', 'iso_9001', 'iso_14001', 'sia', 'internal', 'project', 'other'
);
create type public.reference_review_status as enum ('to_review', 'approved', 'retired');
create type public.ai_suggestion_status as enum ('pending', 'accepted', 'modified', 'rejected');
create type public.cluster_status as enum ('active', 'acknowledged', 'resolved');

-- -----------------------------------------------------------------------------
-- Generische Trigger-Funktionen
-- -----------------------------------------------------------------------------

-- Setzt updated_at / updated_by bei jeder Änderung.
create or replace function app.touch_row()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(app.uid(), new.updated_by);
  return new;
end;
$$;

-- Liefert die aktuell angemeldete Benutzer-ID (Supabase-kompatibel: request.jwt.claims oder claim.sub).
create or replace function app.uid()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant execute on function app.uid() to authenticated, service_role;
