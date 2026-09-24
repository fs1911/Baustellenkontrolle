-- Sandbox-E-Mails (nur Entwicklung/Staging) können in Supabase Storage abgelegt werden
-- (Cloudflare Workers haben kein beschreibbares Dateisystem): Pfad attachments/mail-sandbox/*.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
      set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'message/rfc822', 'application/json']
      where id = 'attachments';
  end if;
end $$;
