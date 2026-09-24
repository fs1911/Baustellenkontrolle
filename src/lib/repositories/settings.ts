import "server-only";
import type { Tx } from "@/lib/db/client";
import { parseSettings, type AllSettings } from "@/lib/domain/settings";

export async function loadSettings(tx: Tx): Promise<AllSettings> {
  const rows = await tx<{ key: string; value: unknown }[]>`select key, value from public.system_settings`;
  return parseSettings(rows);
}
