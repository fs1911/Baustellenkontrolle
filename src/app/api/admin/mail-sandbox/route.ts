import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readSandboxMail } from "@/lib/services/mail";

/** Download einer Sandbox-E-Mail (.eml) – nur Administratoren, nur im Sandbox-Modus relevant. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.permissions.is_admin) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const eml = await readSandboxMail(id);
  if (!eml) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(eml), { headers: { "Content-Type": "message/rfc822", "Content-Disposition": `attachment; filename="${id}.eml"` } });
}
