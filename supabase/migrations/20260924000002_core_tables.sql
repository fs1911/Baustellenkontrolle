-- =============================================================================
-- Baustellenkontrolle – Kerntabellen
-- Konventionen: UUID-PK, created_at/updated_at, created_by/updated_by, company_id als
-- Mandantenbezug, deleted_at für Soft Delete, validierte Enums, Indizes für Dashboards.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Benutzer, Rollen
-- -----------------------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  business_email text not null check (business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  job_title text,
  phone text,
  default_company_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.roles (
  code public.app_role primary key,
  label text not null,
  description text not null,
  is_group_capable boolean not null default false
);

insert into public.roles (code, label, description, is_group_capable) values
  ('admin', 'Administrator', 'Verwaltet Stammdaten, Benutzer, Kataloge und Einstellungen. Sieht alle Daten.', true),
  ('group_ims', 'Gruppen-IMS / SIBE', 'Führt Kontrollen gesellschaftsübergreifend durch, prüft, gibt frei und versendet Berichte.', true),
  ('project_manager', 'Projektleiter / Bauleiter', 'Kontrollen auf zugeordneten Baustellen, Massnahmen bearbeiten und abschliessen.', false),
  ('site_foreman', 'Polier / Baustellenverantwortlicher', 'Sieht zugewiesene Baustellen, kommentiert und setzt Massnahmen um.', false),
  ('viewer', 'Lesender Benutzer / Management', 'Sieht freigegebene Berichte und Dashboards, keine Bearbeitungsrechte.', true);

-- Gesellschaften
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  short_code text not null unique check (short_code ~ '^[A-Z0-9]{2,8}$'),
  street text,
  postal_code text,
  city text,
  country text not null default 'CH',
  primary_color text check (primary_color is null or primary_color ~* '^#[0-9a-f]{6}$'),
  email_sender_name text,
  default_distribution text[] not null default '{}',
  report_disclaimer text,
  confidentiality_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.user_profiles
  add constraint user_profiles_default_company_fk
  foreign key (default_company_id) references public.companies (id) on delete set null;

-- Rollenzuweisung. company_id NULL = gruppenweite Rolle (nur admin, group_ims, viewer).
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  role public.app_role not null references public.roles (code),
  company_id uuid references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  constraint user_roles_group_scope_check
    check (company_id is not null or role in ('admin', 'group_ims', 'viewer'))
);
create unique index user_roles_unique_idx
  on public.user_roles (user_id, role, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index user_roles_user_idx on public.user_roles (user_id);

create table public.company_logos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg')),
  width integer,
  height integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid()
);
create unique index company_logos_active_idx on public.company_logos (company_id) where is_active;

-- -----------------------------------------------------------------------------
-- Projekte, Baustellen, Zuordnungen
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_number text not null,
  name text not null check (char_length(name) between 2 and 200),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  unique (company_id, project_number)
);

create table public.construction_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid references public.projects (id),
  site_number text not null,
  name text not null check (char_length(name) between 2 and 200),
  street text,
  postal_code text,
  city text,
  canton text check (canton is null or canton ~ '^[A-Z]{2}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  unique (company_id, site_number)
);
create index construction_sites_company_idx on public.construction_sites (company_id);

create table public.site_memberships (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.construction_sites (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  role public.app_role not null check (role in ('project_manager', 'site_foreman', 'viewer')),
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  unique (site_id, user_id, role)
);
create index site_memberships_user_idx on public.site_memberships (user_id);

-- -----------------------------------------------------------------------------
-- Kategorien, Referenzkatalog
-- -----------------------------------------------------------------------------
create table public.finding_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  sort_order integer not null,
  name text not null,
  description text,
  default_risk public.risk_level not null default 'medium',
  keywords text[] not null default '{}',
  internal_rule text,
  sample_action text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid
);

create table public.finding_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.finding_categories (id) on delete cascade,
  code text not null unique,
  name text not null,
  description text,
  default_risk public.risk_level,
  keywords text[] not null default '{}',
  sample_action text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid
);
create index finding_subcategories_category_idx on public.finding_subcategories (category_id);

-- Referenzen sind Orientierungshilfen, keine Rechtsdatenbank. Jede Änderung erzeugt eine neue
-- Version (supersedes_id); nur "approved" Einträge werden in Berichten ohne Prüfvermerk gezeigt.
create table public.legal_references (
  id uuid primary key default gen_random_uuid(),
  reference_type public.reference_type not null,
  code text not null,
  title text not null,
  description text,
  url text check (url is null or url ~* '^https://'),
  source text,
  retrieved_at date,
  source_version text,
  version_no integer not null default 1 check (version_no >= 1),
  supersedes_id uuid references public.legal_references (id),
  review_status public.reference_review_status not null default 'to_review',
  reviewed_by uuid references public.user_profiles (id),
  reviewed_at timestamptz,
  review_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  constraint legal_references_approval_check
    check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);
create index legal_references_type_idx on public.legal_references (reference_type) where is_active;

create table public.category_reference_mappings (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.finding_categories (id) on delete cascade,
  subcategory_id uuid references public.finding_subcategories (id) on delete cascade,
  legal_reference_id uuid not null references public.legal_references (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid()
);
create unique index category_reference_mappings_unique_idx
  on public.category_reference_mappings (
    category_id,
    coalesce(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    legal_reference_id
  );

-- -----------------------------------------------------------------------------
-- Vorlagen
-- -----------------------------------------------------------------------------
create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade, -- NULL = gruppenweit
  name text not null,
  description text,
  inspection_type public.inspection_type not null default 'routine',
  -- Liste häufiger Feststellungen: [{ "title", "category_code", "subcategory_code", "assessment", "risk_level", "action" }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid
);

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  closing_text text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid
);

-- -----------------------------------------------------------------------------
-- Kontrollen
-- -----------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  template_id uuid references public.inspection_templates (id),
  inspection_type public.inspection_type not null default 'routine',
  status public.inspection_status not null default 'draft',
  inspected_at timestamptz not null default now(),
  inspector_id uuid not null references public.user_profiles (id),
  weather text,
  area text,                      -- Kontrollbereich / Gewerk
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  constraint inspections_completed_check check (status = 'draft' or completed_at is not null)
);
create index inspections_company_date_idx on public.inspections (company_id, inspected_at desc) where deleted_at is null;
create index inspections_site_date_idx on public.inspections (site_id, inspected_at desc) where deleted_at is null;
create index inspections_inspector_idx on public.inspections (inspector_id);

create table public.inspection_participants (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  user_id uuid references public.user_profiles (id),
  full_name text not null,
  function_label text,
  organisation text,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid()
);
create index inspection_participants_inspection_idx on public.inspection_participants (inspection_id);

-- -----------------------------------------------------------------------------
-- Feststellungen
-- -----------------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  number integer not null,
  title text not null check (char_length(title) between 3 and 200),
  description text,
  assessment public.assessment not null,
  category_id uuid references public.finding_categories (id),
  subcategory_id uuid references public.finding_subcategories (id),
  risk_level public.risk_level,
  trade text,                     -- betroffener Bereich / Gewerk
  location text,                  -- Ort auf der Baustelle
  responsible_role text,          -- Verantwortungsrolle (z. B. "Polier", "Subunternehmer Elektro")
  status public.action_status,    -- aus Massnahmen abgeleitet (siehe Trigger)
  reference_note text,
  closed_at timestamptz,
  closure_note text,
  search_text tsvector generated always as (
    to_tsvector('german', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  unique (inspection_id, number),
  -- Positive Feststellungen haben keinen Massnahmenstatus, Abweichungen/Verbesserungen immer.
  constraint findings_status_check check (
    (assessment = 'positive' and status is null) or (assessment <> 'positive' and status is not null)
  ),
  constraint findings_risk_check check (assessment = 'positive' or risk_level is not null),
  -- Geschlossene Feststellung braucht Abschluss-/Verifikationsinformation.
  constraint findings_closed_check check (
    status is distinct from 'closed' or (closed_at is not null and nullif(trim(closure_note), '') is not null)
  ),
  -- Kritische Abweichung nur mit Kategorie, verantwortlicher Rolle und Massnahmenstatus.
  constraint findings_critical_check check (
    not (assessment = 'negative' and risk_level = 'critical')
    or (category_id is not null and nullif(trim(responsible_role), '') is not null and status is not null)
  )
);
create index findings_inspection_idx on public.findings (inspection_id) where deleted_at is null;
create index findings_company_created_idx on public.findings (company_id, created_at desc) where deleted_at is null;
create index findings_site_category_idx on public.findings (site_id, category_id, created_at desc) where deleted_at is null;
create index findings_subcategory_idx on public.findings (subcategory_id, created_at desc) where deleted_at is null;
create index findings_status_idx on public.findings (status) where deleted_at is null;
create index findings_search_idx on public.findings using gin (search_text);
create index findings_title_trgm_idx on public.findings using gin (title extensions.gin_trgm_ops);

create table public.finding_images (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  storage_path text not null unique,
  thumbnail_path text,
  caption text check (caption is null or char_length(caption) <= 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  width integer,
  height integer,
  size_bytes integer check (size_bytes is null or size_bytes <= 15728640),
  metadata_stripped boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  deleted_at timestamptz
);
create index finding_images_finding_idx on public.finding_images (finding_id) where deleted_at is null;

create table public.finding_references (
  finding_id uuid not null references public.findings (id) on delete cascade,
  legal_reference_id uuid not null references public.legal_references (id),
  company_id uuid not null references public.companies (id),
  suggested_by_ai boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  primary key (finding_id, legal_reference_id)
);

-- -----------------------------------------------------------------------------
-- Massnahmen
-- -----------------------------------------------------------------------------
create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  description text not null check (char_length(description) between 3 and 2000),
  responsible_role text,
  responsible_person text,
  responsible_user_id uuid references public.user_profiles (id),
  due_date date,
  status public.action_status not null default 'open',
  completed_at timestamptz,
  completion_note text,
  verified_at timestamptz,
  verified_by uuid references public.user_profiles (id),
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  constraint corrective_actions_resolved_check check (
    status in ('open', 'in_progress') or completed_at is not null
  ),
  constraint corrective_actions_verified_check check (
    status not in ('verified', 'closed')
    or (verified_at is not null and verified_by is not null and nullif(trim(verification_note), '') is not null)
  )
);
create index corrective_actions_finding_idx on public.corrective_actions (finding_id);
create index corrective_actions_open_due_idx on public.corrective_actions (company_id, due_date)
  where status in ('open', 'in_progress');
create index corrective_actions_site_idx on public.corrective_actions (site_id, status);

create table public.action_updates (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.corrective_actions (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  comment text check (comment is null or char_length(comment) <= 2000),
  status_from public.action_status,
  status_to public.action_status,
  created_at timestamptz not null default now(),
  created_by uuid not null default app.uid()
);
create index action_updates_action_idx on public.action_updates (action_id, created_at);

-- Generische Anhänge (z. B. Abschlussnachweise zu Massnahmen, Dokumente zu Referenzen)
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id),
  site_id uuid references public.construction_sites (id),
  entity_type text not null check (entity_type in ('action_update', 'corrective_action', 'legal_reference')),
  entity_id uuid not null,
  bucket text not null check (bucket in ('attachments', 'finding-images')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  deleted_at timestamptz
);
create index attachments_entity_idx on public.attachments (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Berichte und Versand
-- -----------------------------------------------------------------------------
create table public.report_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null,
  last_value integer not null default 0,
  primary key (company_id, year)
);

create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  inspection_id uuid not null unique references public.inspections (id) on delete cascade,
  report_number text not null unique,
  status public.report_status not null default 'draft',
  current_version_id uuid,
  released_at timestamptz,
  released_by uuid references public.user_profiles (id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  updated_by uuid,
  constraint generated_reports_release_check check (
    status in ('draft', 'in_review') or (released_at is not null and released_by is not null)
  )
);

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  version_no integer not null check (version_no >= 1),
  is_final boolean not null default false,
  content jsonb not null,           -- vollständiger, unveränderlicher Berichts-Snapshot
  summary_text text,
  closing_text text,
  pdf_path text,
  pdf_sha256 text,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid(),
  unique (report_id, version_no),
  constraint report_versions_final_check check (not is_final or (pdf_path is not null and pdf_sha256 is not null))
);

alter table public.generated_reports
  add constraint generated_reports_current_version_fk
  foreign key (current_version_id) references public.report_versions (id) on delete set null;

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  site_id uuid not null references public.construction_sites (id),
  report_id uuid not null references public.generated_reports (id) on delete cascade,
  report_version_id uuid not null references public.report_versions (id),
  to_addresses text[] not null check (cardinality(to_addresses) between 1 and 50),
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null check (char_length(subject) between 3 and 300),
  body_text text not null,
  provider text not null,
  provider_message_id text,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  sent_by uuid not null default app.uid() references public.user_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint email_deliveries_sent_check check (status <> 'sent' or sent_at is not null)
);
create index email_deliveries_report_idx on public.email_deliveries (report_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Wiederkehrende Abweichungen, KI
-- -----------------------------------------------------------------------------
create table public.recurring_issue_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  scope text not null check (scope in ('site', 'company', 'group')),
  company_id uuid references public.companies (id) on delete cascade,
  site_id uuid references public.construction_sites (id) on delete cascade,
  category_id uuid references public.finding_categories (id),
  subcategory_id uuid references public.finding_subcategories (id),
  title text not null,
  insight text not null,
  recommendation text,
  score numeric(6, 1) not null,
  score_breakdown jsonb not null,  -- [{ criterion, points, detail }]
  member_count integer not null,
  open_count integer not null default 0,
  overdue_count integer not null default 0,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_days integer not null,
  status public.cluster_status not null default 'active',
  computed_at timestamptz not null default now(),
  constraint recurring_scope_check check (
    (scope = 'site' and site_id is not null and company_id is not null)
    or (scope = 'company' and company_id is not null and site_id is null)
    or (scope = 'group' and company_id is null and site_id is null)
  )
);
create index recurring_clusters_score_idx on public.recurring_issue_clusters (score desc);

create table public.recurring_issue_cluster_members (
  cluster_id uuid not null references public.recurring_issue_clusters (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  similarity numeric(4, 3),
  primary key (cluster_id, finding_id)
);
create index recurring_members_finding_idx on public.recurring_issue_cluster_members (finding_id);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  site_id uuid references public.construction_sites (id),
  finding_id uuid references public.findings (id) on delete cascade,
  inspection_id uuid references public.inspections (id) on delete cascade,
  kind text not null check (kind in ('classification', 'summary', 'text_improvement', 'action')),
  provider text not null,
  model text,
  input_hash text not null,
  suggestion jsonb not null,
  explanation text,
  status public.ai_suggestion_status not null default 'pending',
  decided_by uuid references public.user_profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default app.uid()
);
create index ai_suggestions_finding_idx on public.ai_suggestions (finding_id);

-- -----------------------------------------------------------------------------
-- Audit, Einstellungen
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  company_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null,
  changes jsonb,
  context jsonb
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_time_idx on public.audit_logs (occurred_at desc);

create table public.notification_settings (
  user_id uuid primary key references public.user_profiles (id) on delete cascade,
  email_on_assignment boolean not null default true,
  email_on_overdue boolean not null default true,
  weekly_digest boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- -----------------------------------------------------------------------------
-- updated_at-Trigger
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles', 'companies', 'projects', 'construction_sites', 'finding_categories',
    'finding_subcategories', 'legal_references', 'inspection_templates', 'report_templates',
    'inspections', 'findings', 'corrective_actions', 'generated_reports', 'email_deliveries',
    'system_settings'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function app.touch_row()',
      'trg_' || t || '_touch', t);
  end loop;
end $$;

-- notification_settings hat kein updated_by
create or replace function app.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end; $$;
create trigger trg_notification_settings_touch before update on public.notification_settings
  for each row execute function app.touch_updated_at();
