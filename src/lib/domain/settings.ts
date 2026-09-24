import { z } from "zod";
import { scoringConfigSchema } from "./recurrence";

export const aiSettingsSchema = z.object({
  /** Erlaubt Aufrufe an externe KI-Dienste (Einwilligung/Freigabe durch Administrator). */
  allowExternal: z.boolean().default(false),
  /** Erlaubt das Senden von Fotos an externe KI-Dienste. Standard: nein. */
  allowImages: z.boolean().default(false),
});

export const imageSettingsSchema = z.object({
  stripMetadata: z.boolean().default(true),
});

export const retentionSettingsSchema = z.object({
  inspectionsYears: z.number().int().min(1).max(30).default(10),
  imagesYears: z.number().int().min(1).max(30).default(5),
  emailLogYears: z.number().int().min(1).max(30).default(10),
  auditLogYears: z.number().int().min(1).max(30).default(10),
  aiSuggestionsDays: z.number().int().min(7).max(3650).default(365),
});

export const reportSettingsSchema = z.object({
  defaultDisclaimer: z
    .string()
    .default(
      "Dieser Bericht dokumentiert betriebliche Kontrollfeststellungen zum Zeitpunkt der Kontrolle. Er stellt keine abschliessende rechtliche oder fachliche Beurteilung dar; eine fachliche bzw. rechtliche Würdigung im Einzelfall bleibt vorbehalten. Angegebene Referenzen (z. B. BauAV, VUV, EKAS, Suva, ISO) dienen als Orientierungshilfe.",
    ),
  closingText: z
    .string()
    .default(
      "Die Verantwortlichen werden gebeten, die Massnahmen innert der angegebenen Fristen umzusetzen und die Umsetzung zu dokumentieren. Die Wirksamkeit wird bei der nächsten Kontrolle verifiziert. Positive Feststellungen sollen im Team gewürdigt und als gute Praxis weitergegeben werden.",
    ),
});

export const settingsSchemas = {
  ai: aiSettingsSchema,
  images: imageSettingsSchema,
  retention: retentionSettingsSchema,
  reports: reportSettingsSchema,
  "recurrence.scoring": scoringConfigSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;
export type AllSettings = { [K in SettingsKey]: SettingsValue<K> };

export function parseSettings(rows: { key: string; value: unknown }[]): AllSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    const parsed = settingsSchemas[key].safeParse(map.get(key) ?? {});
    out[key] = parsed.success ? parsed.data : settingsSchemas[key].parse({});
  }
  return out as AllSettings;
}
