-- Lesende Benutzer / Management: sehen abgeschlossene Kontrollen (für gruppenweite Auswertungen)
-- sowie Kontrollen mit freigegebenem Bericht – nie Entwürfe in Erfassung.
-- Berichte selbst bleiben für Lesende auf "freigegeben/versendet" beschränkt (Policy reports_select).
create or replace function app.inspection_released(p_inspection uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.inspections i
    where i.id = p_inspection
      and (i.status in ('completed', 'archived')
           or exists (select 1 from public.generated_reports r where r.inspection_id = i.id and r.status in ('released', 'sent')))
  );
$$;
comment on function app.inspection_released(uuid) is
  'Sichtbarkeit für Lesende: Kontrolle abgeschlossen oder Bericht freigegeben/versendet.';
