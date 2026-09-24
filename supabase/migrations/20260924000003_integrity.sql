-- =============================================================================
-- Baustellenkontrolle – Integritätsregeln (Trigger)
--  * Mandantenbezug (company_id/site_id) wird immer vom Elternobjekt abgeleitet
--  * Laufnummern für Feststellungen und Berichte
--  * Massnahmenstatus -> Feststellungsstatus
--  * Einschränkungen für Poliere (nur Umsetzung, keine Verifikation)
-- =============================================================================

-- Kontrollen: Gesellschaft muss zur Baustelle passen.
create or replace function app.inspections_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.construction_sites where id = new.site_id;
  if v_company is null then
    raise exception 'Baustelle nicht gefunden' using errcode = '23503';
  end if;
  if new.company_id is not null and new.company_id <> v_company then
    raise exception 'Die Baustelle gehört nicht zur gewählten Gesellschaft' using errcode = '23514';
  end if;
  new.company_id := v_company;
  if new.status <> 'draft' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end; $$;
create trigger trg_inspections_scope before insert or update of site_id, company_id, status
  on public.inspections for each row execute function app.inspections_scope();

create or replace function app.child_of_inspection_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  select company_id into new.company_id from public.inspections where id = new.inspection_id;
  if new.company_id is null then
    raise exception 'Kontrolle nicht gefunden' using errcode = '23503';
  end if;
  return new;
end; $$;
create trigger trg_inspection_participants_scope before insert or update of inspection_id
  on public.inspection_participants for each row execute function app.child_of_inspection_scope();

-- Feststellungen: Scope, Laufnummer, Statusinitialisierung
create or replace function app.findings_before_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and new.inspection_id <> old.inspection_id then
    raise exception 'Eine Feststellung kann nicht in eine andere Kontrolle verschoben werden' using errcode = '23514';
  end if;
  select company_id, site_id into new.company_id, new.site_id
    from public.inspections where id = new.inspection_id;
  if new.company_id is null then
    raise exception 'Kontrolle nicht gefunden' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(new.inspection_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.findings where inspection_id = new.inspection_id;
  end if;
  if new.assessment = 'positive' then
    new.status := null;
    new.closed_at := null;
    new.closure_note := null;
  elsif new.status is null then
    new.status := 'open';
  end if;
  if new.subcategory_id is not null then
    select category_id into new.category_id from public.finding_subcategories where id = new.subcategory_id;
  end if;
  return new;
end; $$;
create trigger trg_findings_before_write before insert or update on public.findings
  for each row execute function app.findings_before_write();

-- Kinder von Feststellungen erben company_id / site_id
create or replace function app.child_of_finding_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_company uuid; v_site uuid;
begin
  select company_id, site_id into v_company, v_site from public.findings where id = new.finding_id;
  if v_company is null then
    raise exception 'Feststellung nicht gefunden' using errcode = '23503';
  end if;
  new.company_id := v_company;
  if tg_table_name <> 'finding_references' then
    new.site_id := v_site;
  end if;
  return new;
end; $$;
create trigger trg_finding_images_scope before insert or update of finding_id
  on public.finding_images for each row execute function app.child_of_finding_scope();
create trigger trg_corrective_actions_scope before insert or update of finding_id
  on public.corrective_actions for each row execute function app.child_of_finding_scope();
create trigger trg_finding_references_scope before insert or update of finding_id
  on public.finding_references for each row execute function app.child_of_finding_scope();

create or replace function app.action_updates_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  select company_id, site_id into new.company_id, new.site_id from public.corrective_actions where id = new.action_id;
  if new.company_id is null then
    raise exception 'Massnahme nicht gefunden' using errcode = '23503';
  end if;
  return new;
end; $$;
create trigger trg_action_updates_scope before insert on public.action_updates
  for each row execute function app.action_updates_scope();

-- Berichte
create or replace function app.next_report_number(p_company uuid)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_year integer := extract(year from now() at time zone 'Europe/Zurich');
        v_value integer; v_code text;
begin
  select short_code into v_code from public.companies where id = p_company;
  insert into public.report_counters (company_id, year, last_value) values (p_company, v_year, 1)
  on conflict (company_id, year) do update set last_value = public.report_counters.last_value + 1
  returning last_value into v_value;
  return format('%s-%s-%s', v_code, v_year, lpad(v_value::text, 4, '0'));
end; $$;
revoke all on function app.next_report_number(uuid) from public;

create or replace function app.generated_reports_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  select company_id, site_id into new.company_id, new.site_id from public.inspections where id = new.inspection_id;
  if new.company_id is null then
    raise exception 'Ein Bericht erfordert eine Kontrolle mit gewählter Gesellschaft' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.report_number is null then
    new.report_number := app.next_report_number(new.company_id);
  end if;
  return new;
end; $$;
create trigger trg_generated_reports_scope before insert or update of inspection_id
  on public.generated_reports for each row execute function app.generated_reports_scope();

create or replace function app.child_of_report_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  select company_id, site_id into new.company_id, new.site_id from public.generated_reports where id = new.report_id;
  if new.company_id is null then
    raise exception 'Bericht nicht gefunden' using errcode = '23503';
  end if;
  return new;
end; $$;
create trigger trg_report_versions_scope before insert on public.report_versions
  for each row execute function app.child_of_report_scope();
create trigger trg_email_deliveries_scope before insert on public.email_deliveries
  for each row execute function app.child_of_report_scope();

-- Versandprotokoll: nur Berichtsversionen desselben Berichts
create or replace function app.email_deliveries_version_check()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.report_versions v
    where v.id = new.report_version_id and v.report_id = new.report_id and v.is_final
  ) then
    raise exception 'Versand nur für eine freigegebene (finale) Berichtsversion möglich' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger trg_email_deliveries_version before insert on public.email_deliveries
  for each row execute function app.email_deliveries_version_check();

create or replace function app.ai_suggestions_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.finding_id is not null then
    select company_id, site_id into new.company_id, new.site_id from public.findings where id = new.finding_id;
  elsif new.inspection_id is not null then
    select company_id, site_id into new.company_id, new.site_id from public.inspections where id = new.inspection_id;
  end if;
  return new;
end; $$;
create trigger trg_ai_suggestions_scope before insert on public.ai_suggestions
  for each row execute function app.ai_suggestions_scope();

-- -----------------------------------------------------------------------------
-- Massnahmen: Zeitstempel, Rollenbeschränkungen, Statussynchronisation
-- -----------------------------------------------------------------------------
create or replace function app.corrective_actions_before_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_uid uuid := app.uid();
begin
  if new.status in ('resolved', 'verified', 'closed') and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status in ('open', 'in_progress') then
    new.completed_at := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  if new.status in ('verified', 'closed') then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, v_uid);
  end if;

  -- Poliere (nur "work"-Recht, kein "edit"-Recht) dürfen ausschliesslich umsetzen:
  -- Status offen/in Bearbeitung/behoben und Abschlussbemerkung. Keine Verifikation.
  if tg_op = 'UPDATE' and v_uid is not null
     and not (new.site_id in (select app.edit_site_ids())) then
    if new.status in ('verified', 'closed') or old.status in ('verified', 'closed') then
      raise exception 'Verifikation und Abschluss sind Projektleitung bzw. SIBE vorbehalten' using errcode = '42501';
    end if;
    if new.description is distinct from old.description
       or new.responsible_role is distinct from old.responsible_role
       or new.responsible_person is distinct from old.responsible_person
       or new.responsible_user_id is distinct from old.responsible_user_id
       or new.due_date is distinct from old.due_date
       or new.finding_id is distinct from old.finding_id then
      raise exception 'Keine Berechtigung, Massnahmendefinition oder Frist zu ändern' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_corrective_actions_before_write before insert or update on public.corrective_actions
  for each row execute function app.corrective_actions_before_write();

-- Feststellungsstatus = am wenigsten fortgeschrittener Status aller Massnahmen.
create or replace function app.sync_finding_status(p_finding uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_status public.action_status; v_closed_at timestamptz; v_note text;
begin
  select min(status), max(verified_at),
         string_agg(nullif(trim(coalesce(verification_note, completion_note)), ''), ' | ')
    into v_status, v_closed_at, v_note
    from public.corrective_actions where finding_id = p_finding;
  if v_status is null then
    return;
  end if;
  update public.findings f set
    status = v_status,
    closed_at = case when v_status = 'closed' then coalesce(v_closed_at, now()) end,
    closure_note = case when v_status = 'closed' then coalesce(v_note, 'Massnahme verifiziert') end
  where f.id = p_finding and f.assessment <> 'positive' and f.status is distinct from v_status;
end; $$;
revoke all on function app.sync_finding_status(uuid) from public;

create or replace function app.corrective_actions_after_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform app.sync_finding_status(coalesce(new.finding_id, old.finding_id));
  return null;
end; $$;
create trigger trg_corrective_actions_after_write after insert or update or delete on public.corrective_actions
  for each row execute function app.corrective_actions_after_write();

-- Profile: nur Administratoren dürfen Aktivstatus ändern.
create or replace function app.user_profiles_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if app.uid() is not null and new.is_active is distinct from old.is_active and not app.is_admin() then
    raise exception 'Nur Administratoren dürfen Benutzer aktivieren oder deaktivieren' using errcode = '42501';
  end if;
  return new;
end; $$;
