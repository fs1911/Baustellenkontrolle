// Supabase Edge Function (Deno): zeitgesteuerter Auslöser für die Neuberechnung wiederkehrender
// Abweichungen. Aufruf per Supabase Cron (pg_cron + pg_net) oder Scheduler, z. B. täglich 05:00.
// Secrets: APP_BASE_URL, CRON_SECRET (supabase secrets set ...).
Deno.serve(async () => {
  const base = Deno.env.get("APP_BASE_URL");
  const secret = Deno.env.get("CRON_SECRET");
  if (!base || !secret) return new Response("APP_BASE_URL/CRON_SECRET fehlen", { status: 500 });
  const res = await fetch(`${base}/api/jobs/recurrence`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
});
