-- =============================================================================
-- Baustellenkontrolle – Berechtigungsmodell und Row Level Security
--
-- Rechte werden ausschliesslich hier (Datenbank) durchgesetzt. Die Anwendung setzt pro
-- Request "role authenticated" + JWT-Claims (sub), identisch zu Supabase/PostgREST.
--
--  manageable companies : admin / group_ims (gruppenweit oder für die Gesellschaft)
--  edit sites           : Baustellen manageable companies + Mitgliedschaft project_manager
--  work sites           : edit sites + Mitgliedschaft site_foreman
--  viewer sites         : viewer-Rolle (Gesellschaft/gruppenweit) + Mitgliedschaft viewer
--                         -> nur freigegebene/versendete Berichte sichtbar
-- =============================================================================

create or replace function app.has_group_role(p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.user_roles r
    join public.user_profiles p on p.id = r.user_id and p.is_active
    where r.user_id = app.uid() and r.company_id is null and r.role = any (p_roles)
  );
$$;

create or replace function app.has_company_role(p_company uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.user_roles r
    join public.user_profiles p on p.id = r.user_id and p.is_active
    where r.user_id = app.uid() and r.role = any (p_roles)
      and (r.company_id is null or r.company_id = p_company)
  );
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select app.has_group_role(array['admin']::public.app_role[]);
$$;

create or replace function app.is_catalog_editor()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select app.has_group_role(array['admin', 'group_ims']::public.app_role[]);
$$;

create or replace function app.manageable_company_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select c.id from public.companies c
  where exists (
    select 1 from public.user_roles r
    join public.user_profiles p on p.id = r.user_id and p.is_active
    where r.user_id = app.uid() and r.role in ('admin', 'group_ims')
      and (r.company_id is null or r.company_id = c.id)
  );
$$;

create or replace function app.edit_site_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select s.id from public.construction_sites s
  where s.company_id in (select app.manageable_company_ids())
  union
  select m.site_id from public.site_memberships m
  join public.user_profiles p on p.id = m.user_id and p.is_active
  where m.user_id = app.uid() and m.role = 'project_manager';
$$;

create or replace function app.work_site_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select app.edit_site_ids()
  union
  select m.site_id from public.site_memberships m
  join public.user_profiles p on p.id = m.user_id and p.is_active
  where m.user_id = app.uid() and m.role = 'site_foreman';
$$;

create or replace function app.viewer_site_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select s.id from public.construction_sites s
  where app.has_company_role(s.company_id, array['viewer']::public.app_role[])
  union
  select m.site_id from public.site_memberships m
  join public.user_profiles p on p.id = m.user_id and p.is_active
  where m.user_id = app.uid() and m.role = 'viewer';
$$;

create or replace function app.readable_company_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select c.id from public.companies c
  where exists (
    select 1 from public.user_roles r
    join public.user_profiles p on p.id = r.user_id and p.is_active
    where r.user_id = app.uid() and (r.company_id is null or r.company_id = c.id)
  )
  union
  select s.company_id from public.construction_sites s
  join public.site_memberships m on m.site_id = s.id
  where m.user_id = app.uid();
$$;

create or replace function app.inspection_released(p_inspection uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.generated_reports r
    where r.inspection_id = p_inspection and r.status in ('released', 'sent')
  );
$$;

create or replace function app.can_read_inspection(p_inspection uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.inspections i
    where i.id = p_inspection
      and (
        i.site_id in (select app.work_site_ids())
        or (i.site_id in (select app.viewer_site_ids()) and app.inspection_released(i.id))
      )
  );
$$;

create or replace function app.can_read_finding(p_finding uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.findings f where f.id = p_finding and app.can_read_inspection(f.inspection_id)
  );
$$;

create or replace function app.visible_user_ids()
returns setof uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select app.uid()
  union
  select r.user_id from public.user_roles r
  where r.company_id is null or r.company_id in (select app.readable_company_ids())
  union
  select m.user_id from public.site_memberships m
  where m.site_id in (select app.work_site_ids());
$$;

-- Clientseitig lesbare Zusammenfassung der eigenen Rechte (für UI-Steuerung; Durchsetzung bleibt RLS).
create or replace function app.my_permissions()
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'user_id', app.uid(),
    'is_admin', app.is_admin(),
    'is_catalog_editor', app.is_catalog_editor(),
    'group_roles', coalesce((select jsonb_agg(distinct r.role) from public.user_roles r
                             where r.user_id = app.uid() and r.company_id is null), '[]'::jsonb),
    'company_roles', coalesce((select jsonb_agg(jsonb_build_object('company_id', r.company_id, 'role', r.role))
                               from public.user_roles r where r.user_id = app.uid() and r.company_id is not null), '[]'::jsonb),
    'manageable_company_ids', coalesce((select jsonb_agg(x) from app.manageable_company_ids() x), '[]'::jsonb),
    'edit_site_ids', coalesce((select jsonb_agg(x) from app.edit_site_ids() x), '[]'::jsonb),
    'work_site_ids', coalesce((select jsonb_agg(x) from app.work_site_ids() x), '[]'::jsonb),
    'viewer_site_ids', coalesce((select jsonb_agg(x) from app.viewer_site_ids() x), '[]'::jsonb)
  );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.has_group_role(public.app_role[])', 'app.has_company_role(uuid, public.app_role[])',
    'app.is_admin()', 'app.is_catalog_editor()', 'app.manageable_company_ids()', 'app.edit_site_ids()',
    'app.work_site_ids()', 'app.viewer_site_ids()', 'app.readable_company_ids()',
    'app.inspection_released(uuid)', 'app.can_read_inspection(uuid)', 'app.can_read_finding(uuid)',
    'app.visible_user_ids()', 'app.my_permissions()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

create trigger trg_user_profiles_guard before update on public.user_profiles
  for each row execute function app.user_profiles_guard();

-- Projektleiter, die eine Baustelle anlegen, werden automatisch zugeordnet.
create or replace function app.construction_sites_after_insert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if app.uid() is not null and not (new.company_id in (select app.manageable_company_ids())) then
    insert into public.site_memberships (site_id, user_id, role)
    values (new.id, app.uid(), 'project_manager') on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger trg_construction_sites_after_insert after insert on public.construction_sites
  for each row execute function app.construction_sites_after_insert();

-- -----------------------------------------------------------------------------
-- Grants: anon hat keinerlei Zugriff, authenticated nur über RLS.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public revoke all on tables from anon;

-- RLS auf allen Tabellen aktivieren
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- Stammdaten Benutzer
create policy user_profiles_select on public.user_profiles for select to authenticated
  using (id in (select app.visible_user_ids()) or app.is_admin());
create policy user_profiles_update on public.user_profiles for update to authenticated
  using (id = app.uid() or app.is_admin()) with check (id = app.uid() or app.is_admin());
create policy user_profiles_insert on public.user_profiles for insert to authenticated
  with check (app.is_admin());

create policy roles_select on public.roles for select to authenticated using (true);

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = app.uid() or app.is_admin());
create policy user_roles_write on public.user_roles for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy notification_settings_own on public.notification_settings for all to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid());

-- Gesellschaften
create policy companies_select on public.companies for select to authenticated
  using (id in (select app.readable_company_ids()));
create policy companies_write on public.companies for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy company_logos_select on public.company_logos for select to authenticated
  using (company_id in (select app.readable_company_ids()));
create policy company_logos_write on public.company_logos for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Projekte und Baustellen
create policy projects_select on public.projects for select to authenticated
  using (company_id in (select app.readable_company_ids()));
create policy projects_insert on public.projects for insert to authenticated
  with check (company_id in (select app.manageable_company_ids())
              or app.has_company_role(company_id, array['project_manager']::public.app_role[]));
create policy projects_update on public.projects for update to authenticated
  using (company_id in (select app.manageable_company_ids())
         or app.has_company_role(company_id, array['project_manager']::public.app_role[]))
  with check (company_id in (select app.manageable_company_ids())
              or app.has_company_role(company_id, array['project_manager']::public.app_role[]));

create policy sites_select on public.construction_sites for select to authenticated
  using (id in (select app.work_site_ids()) or id in (select app.viewer_site_ids()));
create policy sites_insert on public.construction_sites for insert to authenticated
  with check (company_id in (select app.manageable_company_ids())
              or app.has_company_role(company_id, array['project_manager']::public.app_role[]));
create policy sites_update on public.construction_sites for update to authenticated
  using (id in (select app.edit_site_ids())) with check (id in (select app.edit_site_ids()));
create policy sites_delete on public.construction_sites for delete to authenticated
  using (app.is_admin());

create policy site_memberships_select on public.site_memberships for select to authenticated
  using (user_id = app.uid() or site_id in (select app.edit_site_ids()));
create policy site_memberships_write on public.site_memberships for all to authenticated
  using (exists (select 1 from public.construction_sites s where s.id = site_id
                 and s.company_id in (select app.manageable_company_ids())))
  with check (exists (select 1 from public.construction_sites s where s.id = site_id
                      and s.company_id in (select app.manageable_company_ids())));

-- Kataloge (für alle lesbar, Pflege durch Admin/IMS)
create policy categories_select on public.finding_categories for select to authenticated using (true);
create policy categories_write on public.finding_categories for all to authenticated
  using (app.is_catalog_editor()) with check (app.is_catalog_editor());
create policy subcategories_select on public.finding_subcategories for select to authenticated using (true);
create policy subcategories_write on public.finding_subcategories for all to authenticated
  using (app.is_catalog_editor()) with check (app.is_catalog_editor());
create policy legal_references_select on public.legal_references for select to authenticated using (true);
create policy legal_references_write on public.legal_references for all to authenticated
  using (app.is_catalog_editor()) with check (app.is_catalog_editor());
create policy mappings_select on public.category_reference_mappings for select to authenticated using (true);
create policy mappings_write on public.category_reference_mappings for all to authenticated
  using (app.is_catalog_editor()) with check (app.is_catalog_editor());

create policy inspection_templates_select on public.inspection_templates for select to authenticated
  using (company_id is null or company_id in (select app.readable_company_ids()));
create policy inspection_templates_write on public.inspection_templates for all to authenticated
  using (app.is_catalog_editor() or company_id in (select app.manageable_company_ids()))
  with check (app.is_catalog_editor() or company_id in (select app.manageable_company_ids()));
create policy report_templates_select on public.report_templates for select to authenticated
  using (company_id is null or company_id in (select app.readable_company_ids()));
create policy report_templates_write on public.report_templates for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Kontrollen
create policy inspections_select on public.inspections for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and app.inspection_released(id)));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (site_id in (select app.edit_site_ids())
              and (inspector_id = app.uid() or company_id in (select app.manageable_company_ids())));
create policy inspections_update on public.inspections for update to authenticated
  using (site_id in (select app.edit_site_ids())) with check (site_id in (select app.edit_site_ids()));
create policy inspections_delete on public.inspections for delete to authenticated
  using (company_id in (select app.manageable_company_ids()));

create policy participants_select on public.inspection_participants for select to authenticated
  using (app.can_read_inspection(inspection_id));
create policy participants_write on public.inspection_participants for all to authenticated
  using (exists (select 1 from public.inspections i where i.id = inspection_id and i.site_id in (select app.edit_site_ids())))
  with check (exists (select 1 from public.inspections i where i.id = inspection_id and i.site_id in (select app.edit_site_ids())));

-- Feststellungen und Kinder
create policy findings_select on public.findings for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and app.inspection_released(inspection_id)));
create policy findings_insert on public.findings for insert to authenticated
  with check (exists (select 1 from public.inspections i where i.id = inspection_id
                      and i.site_id in (select app.edit_site_ids())));
create policy findings_update on public.findings for update to authenticated
  using (site_id in (select app.edit_site_ids())) with check (site_id in (select app.edit_site_ids()));
create policy findings_delete on public.findings for delete to authenticated
  using (site_id in (select app.edit_site_ids()));

create policy finding_images_select on public.finding_images for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and app.can_read_finding(finding_id)));
create policy finding_images_write on public.finding_images for all to authenticated
  using (site_id in (select app.edit_site_ids()))
  with check (exists (select 1 from public.findings f where f.id = finding_id and f.site_id in (select app.edit_site_ids())));

create policy finding_references_select on public.finding_references for select to authenticated
  using (app.can_read_finding(finding_id));
create policy finding_references_write on public.finding_references for all to authenticated
  using (exists (select 1 from public.findings f where f.id = finding_id and f.site_id in (select app.edit_site_ids())))
  with check (exists (select 1 from public.findings f where f.id = finding_id and f.site_id in (select app.edit_site_ids())));

create policy actions_select on public.corrective_actions for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and app.can_read_finding(finding_id)));
create policy actions_insert on public.corrective_actions for insert to authenticated
  with check (exists (select 1 from public.findings f where f.id = finding_id and f.site_id in (select app.edit_site_ids())));
create policy actions_update on public.corrective_actions for update to authenticated
  using (site_id in (select app.work_site_ids())) with check (site_id in (select app.work_site_ids()));
create policy actions_delete on public.corrective_actions for delete to authenticated
  using (site_id in (select app.edit_site_ids()));

create policy action_updates_select on public.action_updates for select to authenticated
  using (site_id in (select app.work_site_ids()) or site_id in (select app.viewer_site_ids()));
create policy action_updates_insert on public.action_updates for insert to authenticated
  with check (created_by = app.uid()
              and exists (select 1 from public.corrective_actions a where a.id = action_id
                          and a.site_id in (select app.work_site_ids())));

create policy attachments_select on public.attachments for select to authenticated
  using (entity_type = 'legal_reference' or site_id in (select app.work_site_ids()));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    (entity_type = 'legal_reference' and app.is_catalog_editor())
    or (entity_type <> 'legal_reference' and site_id in (select app.work_site_ids()))
  );
create policy attachments_delete on public.attachments for delete to authenticated
  using (created_by = app.uid() or app.is_admin());

-- Berichte
create policy reports_select on public.generated_reports for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and status in ('released', 'sent')));
create policy reports_insert on public.generated_reports for insert to authenticated
  with check (exists (select 1 from public.inspections i where i.id = inspection_id
                      and i.site_id in (select app.edit_site_ids())));
create policy reports_update on public.generated_reports for update to authenticated
  using (site_id in (select app.edit_site_ids())) with check (site_id in (select app.edit_site_ids()));

create policy report_versions_select on public.report_versions for select to authenticated
  using (site_id in (select app.work_site_ids())
         or (site_id in (select app.viewer_site_ids()) and is_final));
create policy report_versions_insert on public.report_versions for insert to authenticated
  with check (exists (select 1 from public.generated_reports r where r.id = report_id
                      and r.site_id in (select app.edit_site_ids())));
-- Berichtsversionen sind unveränderlich: keine Update-/Delete-Policy.

create policy email_deliveries_select on public.email_deliveries for select to authenticated
  using (sent_by = app.uid() or site_id in (select app.edit_site_ids()));
create policy email_deliveries_insert on public.email_deliveries for insert to authenticated
  with check (sent_by = app.uid()
              and exists (select 1 from public.generated_reports r where r.id = report_id
                          and r.site_id in (select app.edit_site_ids())));
create policy email_deliveries_update on public.email_deliveries for update to authenticated
  using (sent_by = app.uid() or company_id in (select app.manageable_company_ids()))
  with check (sent_by = app.uid() or company_id in (select app.manageable_company_ids()));

-- Wiederkehrende Abweichungen (Schreiben nur durch Hintergrundjob / service_role)
create policy clusters_select on public.recurring_issue_clusters for select to authenticated
  using (
    (scope = 'site' and (site_id in (select app.edit_site_ids()) or site_id in (select app.viewer_site_ids())))
    or (scope = 'company' and (company_id in (select app.manageable_company_ids())
                               or app.has_company_role(company_id, array['viewer']::public.app_role[])))
    or (scope = 'group' and app.has_group_role(array['admin', 'group_ims', 'viewer']::public.app_role[]))
  );
create policy cluster_members_select on public.recurring_issue_cluster_members for select to authenticated
  using (app.can_read_finding(finding_id)
         and exists (select 1 from public.recurring_issue_clusters c where c.id = cluster_id));
create policy clusters_update on public.recurring_issue_clusters for update to authenticated
  using (app.is_catalog_editor()) with check (app.is_catalog_editor());

-- KI-Vorschläge
create policy ai_suggestions_select on public.ai_suggestions for select to authenticated
  using (created_by = app.uid() or site_id in (select app.edit_site_ids()));
create policy ai_suggestions_insert on public.ai_suggestions for insert to authenticated
  with check (site_id in (select app.edit_site_ids()));
create policy ai_suggestions_update on public.ai_suggestions for update to authenticated
  using (site_id in (select app.edit_site_ids())) with check (site_id in (select app.edit_site_ids()));

-- Audit Log: nur lesbar für Administratoren; Schreiben ausschliesslich über Trigger/Funktionen.
create policy audit_logs_select on public.audit_logs for select to authenticated using (app.is_admin());

-- Einstellungen
create policy system_settings_select on public.system_settings for select to authenticated using (true);
create policy system_settings_write on public.system_settings for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- report_counters: kein direkter Zugriff (nur über app.next_report_number)
