import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

export class ImageValidationError extends Error {}

export interface ProcessedImage {
  data: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  mimeType: "image/jpeg";
  metadataStripped: boolean;
}

/**
 * Validiert und normalisiert Fotos:
 *  - Formatprüfung anhand des Dateiinhalts (nicht der Endung)
 *  - Ausrichtung gemäss EXIF, Verkleinerung auf max. 2048 px, JPEG-Neukodierung
 *  - Metadaten (inkl. GPS) werden standardmässig entfernt
 * Die Neukodierung neutralisiert zudem eingebettete Fremdinhalte (Malware-Schutzkonzept, siehe docs/security.md).
 */
export async function processPhoto(input: Buffer, opts: { stripMetadata: boolean }): Promise<ProcessedImage> {
  if (input.byteLength === 0 || input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("Das Bild ist leer oder grösser als 15 MB.");
  }
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new ImageValidationError("Die Datei ist kein gültiges Bild.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ImageValidationError("Nur JPEG-, PNG-, WebP- oder HEIC-Bilder sind erlaubt.");
  }
  const base = sharp(input, { limitInputPixels: 60_000_000 }).rotate();
  let pipeline = base.clone().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });
  if (!opts.stripMetadata) pipeline = pipeline.keepMetadata();
  const { data, info } = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const thumbnail = await base
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
  return { data, thumbnail, width: info.width, height: info.height, mimeType: "image/jpeg", metadataStripped: opts.stripMetadata };
}

/** Logos werden immer gerastert (auch SVG), damit nie aktive Inhalte ausgeliefert werden. */
export async function processLogo(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  if (input.byteLength === 0 || input.byteLength > 5 * 1024 * 1024) {
    throw new ImageValidationError("Das Logo ist leer oder grösser als 5 MB.");
  }
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { density: 300 }).metadata();
  } catch {
    throw new ImageValidationError("Die Datei ist kein gültiges Logo (PNG, JPEG, SVG).");
  }
  if (!meta.format || !["png", "jpeg", "svg", "webp"].includes(meta.format)) {
    throw new ImageValidationError("Erlaubte Logo-Formate: PNG, JPEG, SVG, WebP.");
  }
  const { data, info } = await sharp(input, { density: 300 })
    .resize({ width: 1200, height: 400, fit: "inside", withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
