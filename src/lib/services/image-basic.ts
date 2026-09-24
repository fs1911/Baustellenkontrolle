/**
 * Bildprüfung ohne native Bibliothek (Cloudflare Workers, IMAGE_PROCESSING=basic).
 *
 * Die Verkleinerung und JPEG-Neukodierung erfolgt bereits im Browser (src/lib/offline/image-compress.ts).
 * Serverseitig wird hier nur geprüft und bereinigt – mit minimalem CPU-Aufwand:
 *  - Format anhand der Signatur (JPEG, PNG), Abmessungen aus dem Header
 *  - Entfernen von Metadaten (JPEG: APP1–APP15 und Kommentare, u. a. EXIF/GPS/XMP;
 *    PNG: Text-, EXIF- und Zeitstempel-Chunks)
 * Nicht möglich: Drehen, Verkleinern, Neukodieren. Zu grosse Bilder werden abgelehnt.
 */

export type BasicFormat = "jpeg" | "png";

export interface BasicImageInfo {
  format: BasicFormat;
  width: number;
  height: number;
}

export class BasicImageError extends Error {}

export function detectFormat(data: Uint8Array): BasicFormat | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= 8 && png.every((b, i) => data[i] === b)) return "png";
  return null;
}

const u16 = (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1];
const u32 = (d: Uint8Array, o: number) => ((d[o] << 24) >>> 0) + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3];

/** SOF-Marker (Start of Frame), die Abmessungen enthalten. */
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

interface JpegResult {
  width: number;
  height: number;
  stripped: Uint8Array;
}

function processJpeg(data: Uint8Array, strip: boolean): JpegResult {
  const parts: Uint8Array[] = [data.subarray(0, 2)];
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) throw new BasicImageError("Beschädigte JPEG-Datei.");
    const marker = data[offset + 1];
    if (marker === 0xff) {
      offset += 1; // Füllbyte
      continue;
    }
    if (marker === 0xda) {
      // Start of Scan: Rest (komprimierte Bilddaten bis EOI) unverändert übernehmen.
      parts.push(data.subarray(offset));
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(data.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = u16(data, offset + 2);
    if (length < 2 || offset + 2 + length > data.length) throw new BasicImageError("Beschädigte JPEG-Datei.");
    const segment = data.subarray(offset, offset + 2 + length);
    if (SOF_MARKERS.has(marker) && length >= 7) {
      height = u16(data, offset + 5);
      width = u16(data, offset + 7);
    }
    // APP1–APP15 (EXIF, XMP, IPTC, ICC …) und COM entfernen; APP0 (JFIF) bleibt.
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    // ICC-Profil (APP2 "ICC_PROFILE") behalten, damit Farben korrekt bleiben.
    const isIcc = marker === 0xe2 && String.fromCharCode(...segment.subarray(4, 15)) === "ICC_PROFILE";
    if (!strip || !isMetadata || isIcc) parts.push(segment);
    offset += 2 + length;
  }
  if (!width || !height) throw new BasicImageError("Die Datei ist kein gültiges Bild.");
  return { width, height, stripped: concat(parts) };
}

const PNG_METADATA_CHUNKS = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function processPng(data: Uint8Array, strip: boolean): JpegResult {
  if (data.length < 33) throw new BasicImageError("Beschädigte PNG-Datei.");
  const parts: Uint8Array[] = [data.subarray(0, 8)];
  let offset = 8;
  let width = 0;
  let height = 0;
  while (offset + 12 <= data.length) {
    const length = u32(data, offset);
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const end = offset + 12 + length;
    if (end > data.length) throw new BasicImageError("Beschädigte PNG-Datei.");
    if (type === "IHDR") {
      width = u32(data, offset + 8);
      height = u32(data, offset + 12);
    }
    if (!strip || !PNG_METADATA_CHUNKS.has(type)) parts.push(data.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  if (!width || !height) throw new BasicImageError("Die Datei ist kein gültiges Bild.");
  return { width, height, stripped: concat(parts) };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Prüft ein Bild und entfernt auf Wunsch Metadaten. Wirft BasicImageError bei ungültigen Dateien. */
export function inspectImage(
  data: Uint8Array,
  opts: { stripMetadata: boolean; allowed: BasicFormat[]; maxPixels: number },
): BasicImageInfo & { data: Uint8Array } {
  const format = detectFormat(data);
  if (!format || !opts.allowed.includes(format)) {
    throw new BasicImageError(`Erlaubt sind nur ${opts.allowed.map((f) => f.toUpperCase()).join(" und ")}.`);
  }
  const result = format === "jpeg" ? processJpeg(data, opts.stripMetadata) : processPng(data, opts.stripMetadata);
  if (result.width * result.height > opts.maxPixels) {
    throw new BasicImageError("Das Bild ist zu gross. Bitte über die App aufnehmen oder vorher verkleinern.");
  }
  return { format, width: result.width, height: result.height, data: result.stripped };
}
