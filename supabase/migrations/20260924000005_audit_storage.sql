-- =============================================================================
-- Baustellenkontrolle – Audit Trail und Storage
-- =============================================================================

-- Generischer Audit-Trigger: protokolliert Erstellung, Änderung (nur geänderte Felder) und Löschung.
create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
  v_action text := lower(tg_op);
  k text;
begin
  if tg_op = 'UPDATE' then
    v_changes := '{}'::jsonb;
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'updated_by', 'search_text')
         and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    if (v_changes ? 'deleted_at') and (v_new ->> 'deleted_at') is not null then
      v_action := 'soft_delete';
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'search_text' - 'content';
  else
    v_changes := v_old - 'search_text' - 'content';
  end if;

  insert into public.audit_logs (actor_id, company_id, entity_type, entity_id, action, changes)
  values (
    app.uid(),
    case when tg_table_name = 'companies' then (v_row ->> 'id')::uuid else (v_row ->> 'company_id')::uuid end,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'finding_id'),
    v_action,
    v_changes
  );
  return null;
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'companies', 'company_logos', 'user_profiles', 'user_roles', 'projects', 'construction_sites',
    'site_memberships', 'finding_categories', 'finding_subcategories', 'legal_references',
    'category_reference_mappings', 'inspection_templates', 'report_templates', 'inspections',
    'findings', 'finding_images', 'finding_references', 'corrective_actions', 'generated_reports',
    'report_versions', 'email_deliveries', 'system_settings', 'attachments'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function app.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end $$;

-- Explizite Fachereignisse (Freigabe, Versand, Export, Anmeldung, Download).
-- Der Akteur wird immer aus der Sitzung abgeleitet und kann nicht gefälscht werden.
create or replace function app.log_event(
  p_entity_type text, p_entity_id text, p_action text, p_company uuid default null, p_context jsonb default null
) returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_action !~ '^[a-z_]{3,40}$' or p_entity_type !~ '^[a-z_]{3,40}$' then
    raise exception 'Ungültiges Audit-Ereignis' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, company_id, entity_type, entity_id, action, context)
  values (app.uid(), p_company, p_entity_type, p_entity_id, p_action, p_context);
end; $$;
revoke all on function app.log_event(text, text, text, uuid, jsonb) from public;
grant execute on function app.log_event(text, text, text, uuid, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage Buckets (alle privat). Zugriff durch die Anwendung erfolgt serverseitig nach
-- RLS-geprüfter Datenbankabfrage über kurzlebige signierte URLs. Die Policies unten sind
-- zusätzliche Verteidigungslinie für direkte Supabase-Storage-Zugriffe.
-- Pfadschema: <company_id>/<site_id>/<...>
-- -----------------------------------------------------------------------------
-- Das lokale Test-Image enthält nur das Basisschema von storage (ohne Spalte "public");
-- auf Supabase werden die Buckets explizit als privat angelegt.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public') then
    insert into storage.buckets (id, name, public)
    values
      ('company-logos', 'company-logos', false),
      ('finding-images', 'finding-images', false),
      ('generated-reports', 'generated-reports', false),
      ('attachments', 'attachments', false)
    on conflict (id) do update set public = false;
  else
    insert into storage.buckets (id, name)
    values ('company-logos', 'company-logos'), ('finding-images', 'finding-images'),
           ('generated-reports', 'generated-reports'), ('attachments', 'attachments')
    on conflict (id) do nothing;
  end if;
end $$;

-- Spalten file_size_limit / allowed_mime_types existieren je nach Storage-Version.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg']
      where id = 'company-logos';
    update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
      where id = 'finding-images';
    update storage.buckets set file_size_limit = 52428800, allowed_mime_types = array['application/pdf']
      where id = 'generated-reports';
    update storage.buckets set file_size_limit = 15728640,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      where id = 'attachments';
  end if;
end $$;

create or replace function app.storage_site_readable(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-f-]{36}$'
      then ((storage.foldername(p_name))[2])::uuid in (select app.work_site_ids())
    else false
  end;
$$;
create or replace function app.storage_company_readable(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
      then ((storage.foldername(p_name))[1])::uuid in (select app.readable_company_ids())
    else false
  end;
$$;
grant execute on function app.storage_site_readable(text) to authenticated;
grant execute on function app.storage_company_readable(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    execute 'drop policy if exists bk_logos_read on storage.objects';
    execute 'drop policy if exists bk_logos_write on storage.objects';
    execute 'drop policy if exists bk_site_files_read on storage.objects';
    execute $p$create policy bk_logos_read on storage.objects for select to authenticated
      using (bucket_id = 'company-logos' and app.storage_company_readable(name))$p$;
    execute $p$create policy bk_logos_write on storage.objects for insert to authenticated
      with check (bucket_id = 'company-logos' and app.is_admin())$p$;
    execute $p$create policy bk_site_files_read on storage.objects for select to authenticated
      using (bucket_id in ('finding-images', 'generated-reports', 'attachments') and app.storage_site_readable(name))$p$;
    -- Schreiben in finding-images/generated-reports/attachments nur serverseitig (service_role)
    -- nach Validierung, Komprimierung und Metadatenentfernung.
  end if;
end $$;
