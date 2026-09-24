/**
 * Ersatz für "sharp" im Cloudflare-Workers-Build (native Module sind dort nicht verfügbar).
 * Wird nie aufgerufen, solange IMAGE_PROCESSING=basic gesetzt ist (siehe wrangler.jsonc).
 */
export default function sharp(): never {
  throw new Error("sharp ist auf Cloudflare Workers nicht verfügbar – IMAGE_PROCESSING=basic setzen.");
}
