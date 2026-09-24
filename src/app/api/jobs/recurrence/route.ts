import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { recomputeRecurringClusters } from "@/lib/services/recurrence-job";

/** Zeitgesteuerte Neuberechnung (z. B. Vercel Cron / Supabase pg_cron → HTTP). Header: Authorization: Bearer <CRON_SECRET>. */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const r = await recomputeRecurringClusters();
  return NextResponse.json(r);
}
