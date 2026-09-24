/** Gemeinsame Validierungsschemas (Client-Formulare und serverseitige Prüfung). */
import { z } from "zod";
import { ACTION_STATUSES, ASSESSMENTS, INSPECTION_TYPES, RISK_LEVELS } from "./enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const uuid = z.string().uuid("Ungültige Auswahl");
const optionalUuid = z
  .union([uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum");

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, "Name erforderlich").max(120),
  functionLabel: optionalText(120),
  organisation: optionalText(120),
});

export const inspectionSchema = z.object({
  companyId: uuid.describe("Gesellschaft"),
  siteId: uuid,
  inspectionType: z.enum(INSPECTION_TYPES),
  inspectedAt: z.string().min(10, "Datum und Uhrzeit erforderlich"),
  weather: optionalText(120),
  area: optionalText(200),
  notes: optionalText(4000),
  templateId: optionalUuid,
  participants: z.array(participantSchema).max(30).default([]),
});
export type InspectionInput = z.input<typeof inspectionSchema>;

export const siteSchema = z.object({
  companyId: uuid,
  name: z.string().trim().min(2, "Name der Baustelle erforderlich").max(200),
  siteNumber: z.string().trim().min(1, "Baustellen- bzw. Projektnummer erforderlich").max(40),
  street: optionalText(200),
  postalCode: optionalText(10),
  city: optionalText(100),
  canton: z
    .union([
      z
        .string()
        .trim()
        .regex(/^[A-Z]{2}$/, "Kantonskürzel, z. B. AG"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v ? v : null)),
  projectName: optionalText(200),
});
export type SiteInput = z.input<typeof siteSchema>;

export const findingSchema = z
  .object({
    id: optionalUuid,
    inspectionId: uuid,
    title: z.string().trim().min(3, "Titel mit mindestens 3 Zeichen erforderlich").max(200),
    description: optionalText(4000),
    assessment: z.enum(ASSESSMENTS, { message: "Bitte Beurteilung wählen" }),
    categoryId: optionalUuid,
    subcategoryId: optionalUuid,
    riskLevel: z
      .union([z.enum(RISK_LEVELS), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    trade: optionalText(120),
    location: optionalText(200),
    responsibleRole: optionalText(120),
    referenceNote: optionalText(1000),
    referenceIds: z.array(uuid).max(20).default([]),
    aiReferenceIds: z.array(uuid).max(20).default([]),
    actionDescription: optionalText(2000),
    responsiblePerson: optionalText(120),
    dueDate: z
      .union([isoDate, z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    status: z
      .union([z.enum(ACTION_STATUSES), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    completionNote: optionalText(2000),
    aiSuggestionId: optionalUuid,
    aiDecision: z.enum(["accepted", "modified", "rejected"]).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.assessment !== "positive" && !v.riskLevel) {
      ctx.addIssue({ code: "custom", path: ["riskLevel"], message: "Bitte Risikostufe wählen" });
    }
    if (v.assessment !== "positive" && !v.actionDescription) {
      ctx.addIssue({
        code: "custom",
        path: ["actionDescription"],
        message: "Bitte eine Massnahme bzw. einen Massnahmenvorschlag erfassen",
      });
    }
    if (v.assessment === "negative" && v.riskLevel === "critical") {
      if (!v.categoryId)
        ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Kritische Abweichung: Kategorie ist erforderlich" });
      if (!v.responsibleRole)
        ctx.addIssue({
          code: "custom",
          path: ["responsibleRole"],
          message: "Kritische Abweichung: verantwortliche Rolle ist erforderlich",
        });
    }
    if ((v.status === "verified" || v.status === "closed") && !v.completionNote) {
      ctx.addIssue({ code: "custom", path: ["completionNote"], message: "Für Verifikation/Abschluss ist eine Bemerkung erforderlich" });
    }
  });
export type FindingInput = z.input<typeof findingSchema>;
export type FindingData = z.output<typeof findingSchema>;

export const actionUpdateSchema = z
  .object({
    actionId: uuid,
    status: z.enum(ACTION_STATUSES),
    comment: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if ((v.status === "verified" || v.status === "closed") && !v.comment) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Bitte Verifikationsbemerkung erfassen" });
    }
  });
